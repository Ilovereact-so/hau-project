import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import ProductCarusel from "@/components/ProductCarusel";
import TopInfoBar from "@/components/TopInfoBar";


export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
        <TopInfoBar />
        <NavbarContainer mode={1}/>  {/** 1 for products */}
            {children}
        <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Idealne na wyjścia z pupilem"}
        />
        <Footer/>
    </>
  );
}
