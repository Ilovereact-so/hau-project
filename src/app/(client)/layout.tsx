import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import ProductCarusel2 from "@/components/ProductCarusel2";
import TopInfoBar from "@/components/TopInfoBar";
import ClientLayoutShell from "./ClientLayoutShell";
import type { Metadata } from "next";

// Koszyk, kasa, zamówienia i profil to strony prywatne — nie trafiają
// do wyników wyszukiwania (robot może z nich wyjść linkami: `follow`).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientLayoutShell
      topBar={<TopInfoBar />}
      navbar={<NavbarContainer mode={1} />}
      carousel={<ProductCarusel2 title="Dopasuj do swojego pupila" />}
      footer={<Footer />}
      footerCheckout={<Footer className="max-w-[1500px]"/>}
    >
      {children}
    </ClientLayoutShell>
  );
}
