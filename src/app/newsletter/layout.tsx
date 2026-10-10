import type { Metadata } from "next";
import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";

// Strony z linków w mailach (potwierdzenie zapisu, wypisanie) — poza indeksem.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function NewsletterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="patern">
      <TopInfoBar />
      <NavbarContainer mode={1} />
      <main className="flex justify-center px-6 py-16 min-h-[60vh] font-poppins">{children}</main>
      <Footer />
    </div>
  );
}
