import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";


export default function UsingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopInfoBar/>
      <NavbarContainer mode={1}/>  {/** 1 for products */}
        {children}
      <Footer/>
    </>
  );
}
