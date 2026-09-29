import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";

// Ta sama otoczka co pozostałe strony sklepu (subcategory, product, client) —
// TopInfoBar + navbar w wariancie produktowym + stopka. Tło `patern` (miętowe
// kropki) jak w /poradniki — białe karty dokumentów leżą na nim tak samo jak
// artykuły. Layout siedzi na /help, więc obejmuje indeks i każde /help/[slug].
export default function HelpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="patern">
      <TopInfoBar />
      <NavbarContainer mode={1}/>
      {children}
      <Footer />
    </div>
  );
}
