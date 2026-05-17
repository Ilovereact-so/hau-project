import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import ProductCarusel2 from "@/components/ProductCarusel2";
import TopInfoBar from "@/components/TopInfoBar";
import ClientLayoutShell from "./ClientLayoutShell";

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
