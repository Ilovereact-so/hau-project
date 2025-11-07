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
  {
    name: "Poradniki",
    subcategory: [],
    path: "",
  },
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