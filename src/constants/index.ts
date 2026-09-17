export const category = [
  {
    name: "Karmienie",
    subcategory: [ 
      { name: "Maty pod miski dla psa", path: "" },
      { name: "Maty spowalniające dla psa", path: "" },
      { name: "Lickmaty dla psa", path: "" },
      { name: "Maty węchowe dla psa", path: "" },
      { name: "Kule węchowe dla psa", path: "" },
      { name: "Zabawki na smakołyki dla psa", path: "" },
      { name: "Podróże z psem", path: "" },
    ],
    path: "",
  },
  {
    name: "Przysmaki",
    subcategory: [
      { name: "Przysmaki dentystyczne dla psa", path: "" },
      { name: "Gryzaki naturalne dla psa", path: "" },
      { name: "Przysmaki mięsne dla psa", path: "" },
      { name: "Kości do żucia dla psa", path: "" },
      { name: "Ciastka dla psa", path: "" },
      { name: "Przysmaki treningowe dla psa", path: "" },
      { name: "Dosmaczacze dla psa", path: "" },
      { name: "Oleje i pasty dla psa", path: "" },
      { name: "Pozostałe", path: "" },
    ],
    path: "",
  },
  {
    name: "Zabawki",
    subcategory: [
      { name: "Pluszaki dla psa", path: "" },
      { name: "Szarpaki dla psa", path: "" },
      { name: "Gryzaki dla psa", path: "" },
      { name: "Piłki dla psa", path: "" },
      { name: "Frisbee dla psa", path: "" },
    ],
    path: "",
  },
  {
    name: "Spacer",
    subcategory: [
      { name: "Linki", path: "" },
      { name: "Smycze dla psa", path: "" },
      { name: "Obroże dla psa", path: "" },
      { name: "Szelki dla psa", path: "" },
    ],
    path: "",
  },
  {
    name: "Posłania",
    subcategory: [
      { name: "Maty do spania dla psa", path: "" },
      { name: "Dry-bed dla psa", path: "" },
    ],
    path: "",
  },
  {
    name: "Higiena i pielęgnacja",
    subcategory: [
      { name: "Cążki do pazurków dla psów", path: "" },
      { name: "Czyściki dla łap dla psa", path: "" },
      { name: "Worki na odchody dla psa", path: "" },
      { name: "Szczoteczki dla psa", path: "" },
      { name: "Kosmetyki dla psa", path: "" },
      { name: "Ręczniki dla psa", path: "" },
      { name: "Kleszczołapki", path: "" },
    ],
    path: "",
  },
];

/**
 * Poradniki NIE są zwykłą kategorią sklepu — to osobna sekcja treści
 * (typ `guide` w Sanity, strona /poradniki). Wcześniej siedziały w tablicy
 * `category` powyżej i w Sanity jako dokument `category`, przez co menu
 * traktowało je jak kategorię produktową: pusty submenu i link prowadzący
 * do listy produktów, których nigdy nie będzie.
 *
 * `GUIDES_NAV` to link, który navbar renderuje osobno, po kategoriach.
 * `NON_PRODUCT_CATEGORY_SLUGS` to zabezpieczenie na drugą stronę: gdyby w
 * Sanity nadal istniał (albo wrócił) dokument `category` o którymś z tych
 * slugów/tytułów, navbar go odfiltruje zamiast pokazać pustą kategorię.
 * Porównanie idzie po znormalizowanym tytule i slugu, bo dokument mógł zostać
 * dodany ręcznie z polskimi znakami.
 */
export const GUIDES_NAV = {
  title: "Poradniki",
  href: "/poradniki",
} as const;

export const NON_PRODUCT_CATEGORY_SLUGS = [
  "poradniki",
  "poradnik",
  "blog",
] as const;

/**
 * Kanoniczna lista dokumentów Centrum pomocy używana w nawigacji (footer,
 * sidebar na /help). Treść tych dokumentów mieszka w Sanity (typ `helpDocument`),
 * ale SAMA LISTA linków jest tutaj z dwóch powodów:
 *
 * 1. Footer to komponent kliencki ('use client' + useUser z Clerka), więc nie
 *    może wołać `sanityFetch` (server-only). Trzymanie linków w stałej pozwala
 *    footerowi działać bez przerabiania go na serwerowy/fetchujący.
 * 2. Linki w stopce muszą działać ZANIM admin doda cokolwiek w Studio — strona
 *    dokumentu ma wtedy pokazać stan "w przygotowaniu", a nie 404.
 *
 * `column` odwzorowuje istniejący dwukolumnowy układ w stopce.
 * Dokumenty dodane w Sanity poza tą listą i tak pojawią się automatycznie na
 * /help i w sidebarze (patrz getAllHelpDocuments + scalanie w app/help).
 */
export type HelpDocumentLink = {
  title: string;
  slug: string;
  column: 1 | 2;
};

export const HELP_DOCUMENTS: HelpDocumentLink[] = [
  { title: "Regulamin", slug: "regulamin", column: 1 },
  { title: "Polityka prywatności", slug: "polityka-prywatnosci", column: 1 },
  { title: "Zwroty i reklamacje", slug: "zwroty-i-reklamacje", column: 1 },
  { title: "Dostawa", slug: "dostawa", column: 2 },
  { title: "Formy płatności", slug: "formy-platnosci", column: 2 },
  // Baner zgód linkuje do polityki cookies — dokument żyje w Sanity
  // (typ helpDocument, slug "polityka-cookies"); do czasu jego dodania
  // strona pokazuje stan „w przygotowaniu” zamiast 404.
  { title: "Polityka cookies", slug: "polityka-cookies", column: 2 },
];

type BanerItem = {
  title: string;
  description:string;
  path: string;
  baner:string;
//   style: object;
//   buttonStyle: object;
};


export const banerVariants:BanerItem[] = [
    {
        title: "Zabawki BUBA",
        description: `Twój pies na pewno pokocha pluszowych przyjaciół marki BUBA! Do tulenia, gryzienia, szarpania, rzucania, aportowania i miętolenia.`,
        path: "",
        baner: "/baner0.png",
        // style: { paddingLeft: "120px", bottom:"18%"},
        // buttonStyle: {marginLeft:"32px"},
    },
    {
        title: "Zabawki BUBA",
        description: `Twój pies na pewno pokocha pluszowych przyjaciół marki <br> BUBA! Do tulenia, gryzienia, szarpania, rzucania, aportowania <br> i miętolenia.`,
        path: "",
        baner: "/baner1.png",
        // style: { paddingLeft: "120px", bottom:"18%"},
        // buttonStyle: {marginLeft:"32px"},
    },
    {
        title: "Zabawki BUBA",
        description: `Twój pies na pewno pokocha pluszowych przyjaciół marki <br> BUBA! Do tulenia, gryzienia, szarpania, rzucania, aportowania <br> i miętolenia.`,
        path: "",
        baner: "/baner0.png",
        // style: { paddingRight: "100px", bottom:"25%", alignItems: "end", textAlign:"right"},
        // buttonStyle: {},
    }
]