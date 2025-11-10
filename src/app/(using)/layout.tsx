import "../globals.css";
import NavbarContainer from "@/components/NavbarContainer";


export default function UsingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavbarContainer>
        {children}
      </NavbarContainer>
    </>
  );
}
