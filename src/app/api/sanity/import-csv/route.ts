import { NextResponse } from "next/server";
import Papa from "papaparse";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { importJobs } from "@/db/schema";
import { adminDenied } from "@/lib/admin/guard";
import { invalidateCatalogCache } from "@/lib/admin/catalog";
import { recordPriceChanges } from "@/lib/priceHistory";
import { ImportSession, importProductRow, type ImportRowResult } from "@/lib/admin/productImport";

/*
 * Import produktów z CSV — jedna PARTIA wierszy na żądanie.
 * Klient (ImportWizard) dzieli plik na partie, pokazuje postęp i przekazuje
 * `jobId` z pierwszej odpowiedzi, więc cały import to jeden wpis w import_jobs.
 * Zdjęcia nie idą tą trasą (przeglądarka wysyła je z ZIP-a po jednym).
 * Logika wiersza: src/lib/admin/productImport.ts.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ROWS_PER_REQUEST = 50;
const MAX_LOG_LINES = 3000;

export async function POST(req: Request) {
  // Trasa zapisuje do Sanity tokenem z uprawnieniami zapisu — wyłącznie dla admina.
  // (Middleware przepuszcza /api/sanity/* bez logowania, więc kontrola musi być tutaj.)
  const denied = await adminDenied();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
  const { userId } = await auth();

  try {
    const form = await req.formData();
    const csvText = String(form.get("csvText") ?? "");
    const csvName = String(form.get("csvName") ?? "").slice(0, 200);
    const dryRun = form.get("dryRun") === "1" || form.get("mode") === "dry-run";
    // Numer wiersza w pliku (nagłówek = 1), od którego zaczyna się ta partia.
    const firstRow = Math.max(2, Number(form.get("firstRow")) || 2);
    const totalRows = Math.max(0, Number(form.get("totalRows")) || 0);
    const isLast = form.get("last") !== "0";
    let jobId = String(form.get("jobId") ?? "") || null;

    if (!csvText) return NextResponse.json({ error: "Brak danych CSV" }, { status: 400 });

    const parsed = Papa.parse<Record<string, string | undefined>>(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data.filter(Boolean);
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json({ error: `Za dużo wierszy w jednej partii (maks. ${MAX_ROWS_PER_REQUEST}).` }, { status: 400 });
    }

    const session = new ImportSession(dryRun);
    const results: ImportRowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = firstRow + i;
      try {
        results.push(await importProductRow(session, rows[i], rowNumber));
      } catch (err) {
        console.error("[import] row", rowNumber, err);
        session.log(`Failed ${rowNumber}: ${err instanceof Error ? err.message : String(err)}`);
        results.push({ row: rowNumber, ok: false, sku: rows[i].sku });
      }
    }
    const logs = session.logs;

    // ── audyt: jeden wpis import_jobs na cały import (partie dopisują się) ──────
    if (!dryRun) {
      try {
        const okRows = results.filter((r) => r.ok).length;
        const failedRows = results.length - okRows;
        const existing = jobId ? (await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1))[0] : null;
        if (existing) {
          const previousLogs: string[] = (() => {
            try {
              return JSON.parse(existing.logJson ?? "[]");
            } catch {
              return [];
            }
          })();
          const ok = existing.okRows + okRows;
          await db
            .update(importJobs)
            .set({
              okRows: ok,
              failedRows: existing.failedRows + failedRows,
              status: isLast ? (ok === 0 ? "failed" : "done") : "running",
              logJson: JSON.stringify([...previousLogs, ...logs].slice(-MAX_LOG_LINES)),
            })
            .where(eq(importJobs.id, jobId!));
        } else {
          jobId = crypto.randomUUID();
          await db.insert(importJobs).values({
            id: jobId,
            type: "products",
            fileName: (csvName || "produkty.csv").slice(0, 256),
            totalRows: totalRows || rows.length,
            okRows,
            failedRows,
            status: isLast ? (okRows === 0 && rows.length > 0 ? "failed" : "done") : "running",
            logJson: JSON.stringify(logs.slice(-MAX_LOG_LINES)),
            createdBy: userId ?? "admin",
            createdAt: new Date(),
          });
        }
      } catch (e) {
        console.error("import_jobs audit failed:", e);
      }

      await invalidateCatalogCache();
      // Rejestr najniższej ceny z 30 dni — ceny z importu (nowe i zmienione).
      const ids = results.map((r) => r.id).filter((id): id is string => Boolean(id));
      if (ids.length) await recordPriceChanges([...new Set(ids)], "import");
    }

    return NextResponse.json({ logs, results, jobId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Błąd importu" }, { status: 500 });
  }
}
