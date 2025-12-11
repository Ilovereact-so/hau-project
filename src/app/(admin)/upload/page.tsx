'use client';
import React, { useState } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';

import {
  splitList,
  mapCsvRowToProductPartial,
  generateVariants,

  // NOWE helpery – dopiszesz w productImportHelpers.ts
  extractZipImages,
  normalizeSlugForImages,
  matchZipImagesToSlug,
} from '@/sanity/helpers/productImportHelpers';

type CsvRow = Record<string, string | undefined>;

export default function UploadProductsClient() {
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [variantPreview, setVariantPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [zipFile, setZipFile] = useState<File | null>(null); // <<< NEW
  const [zipInfo, setZipInfo] = useState<{ name: string; files: number } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  // CSV

      function parseCsv(text: string) {
        const safeText = String(text || '');
        Papa.parse<CsvRow>(safeText, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          complete: (parsed) => {
            const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
            if (errors.length) console.warn(errors);
        
            const data = Array.isArray(parsed.data) ? parsed.data.filter(Boolean) as CsvRow[] : [];
            setRows(data);
        
            const mapped = data.slice(0, 50).map(mapCsvRowToProductPartial);
            setPreview(mapped);
        
            if (mapped.length) {
              const combos = generateVariants(mapped[0].options || []);
              setVariantPreview(combos.slice(0, 200));
            } else {
              setVariantPreview([]);
            }
          },
        });
      }
    
      function handleCSV(file: File | null) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const txt = String(e.target?.result || '');
          setCsvText(txt);
          parseCsv(txt);
        };
        // wymuszamy UTF-8 podczas czytania pliku
        reader.readAsText(file, 'UTF-8');
      }

  // ZIP

  async function handleZip(file: File | null) {
    setZipError(null);
    setZipInfo(null);

    if (!file) {
      setZipFile(null);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      let fileCount = 0;
      zip.forEach((relativePath, entry) => {
        if (!entry.dir) fileCount++;
      });

      if (fileCount === 0) {
        setZipError('ZIP nie zawiera żadnych plików (albo są tylko foldery).');
        setZipFile(null);
        return;
      }

      setZipFile(file);
      setZipInfo({ name: file.name, files: fileCount });
    } catch (e) {
      console.error('ZIP parse error', e);
      setZipError('Nie udało się odczytać ZIP-a – plik uszkodzony albo nieprawidłowy format.');
      setZipFile(null);
    }
  }


  // MAIN UPLOAD
  async function uploadAll() {
    if (!rows.length) return alert('Załaduj CSV najpierw');

    if (!rows.length) {
    alert('Załaduj CSV najpierw');
    return;
    }

    if (!zipFile) {
      const ok = confirm('Nie wybrano ZIP-a ze zdjęciami. Kontynuować tylko z CSV/URL?');
      if (!ok) return;
    }
    setUploading(true);
    setLogs([]);

    const fd = new FormData();
    fd.append('csvText', csvText);
    if (zipFile) fd.append('zip', zipFile);
    console.log(fd.getAll('zip'));
    try {
      const resp = await fetch('/api/sanity/import-csv', {
        method: 'POST',
        body: fd, // <--- WAŻNE: multipart/form-data automatycznie
      });

      const text = await resp.text();

      // spróbuj JSON
      try {
        const data = JSON.parse(text);
        if (data.logs) setLogs(data.logs);
        else setLogs([text]);
      } catch {
        setLogs([text]); // fallback
      }
    } catch (err: any) {
      console.error(err);
      setLogs([err?.message || String(err)]);
    } finally {
      setUploading(false);
    }
  }

  const sampleCsv = `title,subtitle,intro,sku,slug,shortDescription,description,price,currency,stock,category_slug,type,brand,vendor,tags,images,option_Size,option_Color,option_Extras,properties_width_cm,properties_height_cm,properties_length_cm,unit,weight_g,shipping_weight_g,material,care,isMachineWashable,isWaterproof,isFeatured,isBestseller,chew_strength
"Pumpkin Plush Toy","Soft Corduroy Pumpkin","Idealna miękka zabawka dla psów","PUM-001","pumpkin-plush","Pluszowa dynia — 3 rozmiary","Miękka dynia z materiału corduroy, idealna dla psów małych i średnich.",29.99,PLN,50,toys,plush,PetCo,PetCo,"dynia;halloween","", "S,M,L","orange,beige","rope",12,13,12,cm,140,180,corduroy,"Prać ręcznie",false,false,true,false,medium`;

  return (
    <div className="p-6 w-full px-20 font-poppins bg-[#20201F]">
      <h1 className="text-2xl font-bold mb-4">Upload CSV + ZIP → Sanity</h1>

      {/* CSV PICKER */}
      <p className="block mb-2 font-medium">Wybierz plik CSV</p>
      <label className="mb-4 bg-black px-7 py-3 rounded-full inline-flex cursor-pointer">
        <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCSV(e.target.files?.[0] || null)} />
        <span className="font-bold text-white text-[16px]">Wybierz CSV</span>
      </label>

      {/* ZIP PICKER */}
      <p className="block mb-2 mt-4 font-medium">Wybierz ZIP ze zdjęciami (slugN.jpg)</p>
      <label className="mb-4 bg-black px-7 py-3 rounded-full inline-flex cursor-pointer">
        <input type="file" accept=".zip" className="hidden" onChange={(e) => handleZip(e.target.files?.[0] || null)} />
        <span className="font-bold text-white text-[16px]">Wybierz ZIP</span>
      </label>
      {zipInfo && (
        <div className="text-sm text-green-400">
          ZIP: <b>{zipInfo.name}</b> — znaleziono {zipInfo.files} plików
        </div>
      )}
      {zipError && <div className="text-sm text-red-400 mt-1">{zipError}</div>}
      {/* CSV AREA */}
      <div className="mb-4">
        <label className="block mb-2 font-medium">Lub wklej treść CSV</label>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          className="w-full p-2 border rounded"
        />
        <div className="mt-2 flex gap-2">
          <button className="px-4 py-2 bg-main text-black rounded" onClick={() => parseCsv(csvText)}>
            Parse CSV
          </button>
          <a
            className="px-4 py-2 bg-gray-200 text-black rounded"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`}
            download="sample_products_for_schema.csv"
          >
            Pobierz przykładowy CSV
          </a>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="mb-6 mt-20 grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold">Podgląd produktów</h3>
          <pre className="bg-transparent text-white p-3 rounded max-h-64 overflow-auto">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
        <div>
          <h3 className="font-semibold">Podgląd wariantów</h3>
          <pre className="bg-transparent text-white p-3 rounded max-h-64 overflow-auto">
            {JSON.stringify(variantPreview, null, 2)}
          </pre>
        </div>
      </div>

      {/* UPLOAD */}
      <div className="mb-4">
        <button disabled={uploading} onClick={uploadAll} className="px-7 py-3 bg-main text-black font-bold rounded-full">
          {uploading ? 'Wgrywam...' : 'Upload do Sanity'}
        </button>
      </div>

      <div>
        <h3 className="font-semibold">Log</h3>
        <div className="bg-black text-white p-3 rounded max-h-56 overflow-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-sm">
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
