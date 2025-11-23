import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import ProductsNavbar from "@/components/ProductsNavbar";


export default function UsingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavbarContainer mode={1}/>  {/** 1 for products */}
        {children}
      <Footer/>
    </>
  );
}
