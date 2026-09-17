import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";

// Identyczny layout jak subcategory/[slug]/layout.tsx — TopInfoBar + navbar w
// mode 1 (wariant "produktowy") + Footer. Bez tego pliku /search dziedziczyła
// wyłącznie root layout (który NIE zawiera ani navbaru, ani footera), więc
// strona renderowała się "goła": sama treść na białym tle, bez paska
// nawigacji i stopki. To była główna przyczyna tego, że nie wyglądała jak
// strona subkategorii — sam markup page.tsx był zgodny, brakowało otoczki.
export default function SearchLayout({
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
