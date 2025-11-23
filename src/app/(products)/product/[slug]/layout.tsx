import Footer from "@/components/Footer";
import ProductsNavbar from "@/components/ProductsNavbar";


export default function UsingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ProductsNavbar/>
        {children}
      <Footer/>
    </>
  );
}
