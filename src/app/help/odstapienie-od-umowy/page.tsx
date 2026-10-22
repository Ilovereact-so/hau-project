import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import WithdrawalForm from "@/components/withdrawal/WithdrawalForm";
import { Paw_Filled } from "@/components/ui/paw";
import { pageMetadata } from "@/lib/seo/metadata";
import { RETURN_COST_NOTE, RETURN_WINDOW_DAYS, SELLER } from "@/lib/site";
import { WITHDRAWAL_PATH } from "@/lib/withdrawals";

/*
 * Funkcja odstąpienia od umowy online (dyrektywa (UE) 2023/2673, art. 11a
 * dyrektywy 2011/83/UE — stosowana od 19.06.2026). Link „Odstąp od umowy”
 * jest w stopce, na stronie zamówienia i w mailu z potwierdzeniem zamówienia,
 * więc funkcja jest dostępna przez cały okres na odstąpienie.
 * Parametry `?zamowienie=&email=` wypełniają formularz (linki z maila i profilu).
 */

export const metadata: Metadata = pageMetadata({
  title: "Odstąp od umowy",
  description: `Formularz odstąpienia od umowy zawartej w sklepie HAU — ${RETURN_WINDOW_DAYS} dni na zwrot bez podania przyczyny. Potwierdzenie otrzymasz mailem.`,
  path: WITHDRAWAL_PATH,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function WithdrawalPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 mb-20 max-w-[860px] font-poppins">
      <header>
        <div className="flex items-center gap-2">
          <Paw_Filled className="size-[18px] text-[#6eb0a6]" />
          <Link href="/help" className="text-black text-[clamp(14px,1.4vw,16px)] hover:underline underline-offset-2">Centrum pomocy</Link>
        </div>
        <h1 className="mt-2 font-medium text-black sm:text-[clamp(22px,2.6vw,34px)] text-[20px] leading-tight">
          Odstąp od umowy
        </h1>
        <p className="mt-3 text-[#4E4E4E] text-[clamp(14px,1.4vw,17px)] leading-relaxed">
          Masz {RETURN_WINDOW_DAYS} dni od otrzymania przesyłki na odstąpienie od umowy bez podania przyczyny.
          Wypełnij formularz i potwierdź — od razu wyślemy Ci mailem potwierdzenie z treścią oświadczenia
          oraz datą i godziną jego złożenia. Zasady odsyłania produktów i zwrotu pieniędzy opisuje dokument{" "}
          <Link href="/help/zwroty-i-reklamacje" className="underline underline-offset-2 hover:text-black">Zwroty i reklamacje</Link>.
          {" "}{RETURN_COST_NOTE}
        </p>
      </header>

      <WithdrawalForm
        initialOrderNumber={first(params.zamowienie)}
        initialEmail={first(params.email)}
      />

      <p className="mt-8 text-[13px] leading-relaxed text-[#6C6C6C]">
        Możesz też odstąpić od umowy w dowolny inny jednoznaczny sposób
        {SELLER.email ? <> — np. pisząc na <a href={`mailto:${SELLER.email}`} className="underline underline-offset-2">{SELLER.email}</a></> : null}
        {SELLER.address ? <> albo listownie na adres {SELLER.name ? `${SELLER.name}, ` : ""}{SELLER.address}</> : null}.
        Do zachowania terminu wystarczy wysłanie oświadczenia przed jego upływem.
      </p>
    </Container>
  );
}
