import Footer from "@/components/Footer";
import NavbarContainer from "@/components/NavbarContainer";
import TopInfoBar from "@/components/TopInfoBar";

// Ta sama otoczka co /help i strony produktowe — TopInfoBar + navbar w wariancie
// produktowym (mode 1) + stopka. Layout siedzi na /poradniki, więc obejmuje
// zarówno listę, jak i każdy pojedynczy wpis /poradniki/[slug].
export default function GuidesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopInfoBar />
      <NavbarContainer mode={1} />
      {children}
      <Footer />
    </>
  );
}
