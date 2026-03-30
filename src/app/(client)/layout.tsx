import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import ProductCarusel from "@/components/ProductCarusel";
import ProductCarusel2 from "@/components/ProductCarusel2";
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
        <ProductCarusel2
          title={"Dopasuj do swojego pupila"}
        />
        <Footer/>
    </>
  );
}
