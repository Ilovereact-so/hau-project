import NavbarContainer from "@/components/NavbarContainer";


export default function UsingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavbarContainer mode={0}>  {/** 0 for using */}
        {children}
      </NavbarContainer>
    </>
  );
}
