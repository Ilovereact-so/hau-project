import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";

// Ta sama otoczka co pozostałe strony sklepu (subcategory, product, client) —
// TopInfoBar + navbar w wariancie produktowym + stopka. Layout siedzi na
// /help, więc obejmuje zarówno indeks Centrum pomocy, jak i wszystkie
// /help/[slug].
export default function HelpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopInfoBar />
      <NavbarContainer mode={1}/>
      {children}
      <Footer />
    </>
  );
}
