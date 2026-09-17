import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";

// Ten sam szkielet co /search i /subcategory — TopInfoBar + navbar w wariancie
// "produktowym" (mode 1) + Footer. Obejmuje /kolekcje i /kolekcje/[slug].
export default function CollectionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
        <TopInfoBar />
        <NavbarContainer mode={1}/>  {/** 1 for products */}
            {children}
        <Footer/>
    </>
  );
}
