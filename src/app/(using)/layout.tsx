import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
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
