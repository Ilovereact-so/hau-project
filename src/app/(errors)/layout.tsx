import type { Metadata } from "next"

export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function ErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 return (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#20201F] p-4 font-poppins relative">
    {children}
    <svg id="noice" className='absolute w-full h-full top-0 left-0 z-[1]'>
        <filter id="noise-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="4" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
            <feComponentTransfer>
                <feFuncR type="linear" slope="0.43"></feFuncR>
                <feFuncG type="linear" slope="0.43"></feFuncG>
                <feFuncB type="linear" slope="0.43"></feFuncB>
                <feFuncA type="linear" slope="0.56"></feFuncA>
            </feComponentTransfer>
            <feComponentTransfer>
                <feFuncR type="linear" slope="1.5" intercept="-0.25"/>
                <feFuncG type="linear" slope="1.5" intercept="-0.25"/>
                <feFuncB type="linear" slope="1.5" intercept="-0.25"/>
            </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter="url(#noise-filter)"></rect>
      </svg>
  </div>
  )
}
