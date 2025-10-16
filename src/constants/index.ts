export const category = [
    {
        name : "Karmienie",
        path : ""
    },
    {
        name : "Przysmaki",
        path : ""
    },
    {
        name : "Zabawki",
        path : ""
    },
    {
        name : "Spacer",
        path : ""
    },
    {
        name : "Posłania",
        path : ""
    },
    {
        name : "Higiena i pielęgnacja",
        path : ""
    },
    {
        name : "Poradniki",
        path : ""
    },
]
type BanerItem = {
  title: string;
  description:string;
  path: string;
  baner:string;
  style: object;
  buttonStyle: object;
};


export const banerVariants:BanerItem[] = [
    {
        title: "Zabawki BUBA",
        description: `Twój pies na pewno pokocha pluszowych przyjaciół marki <br> BUBA! Do tulenia, gryzienia, szarpania, rzucania, aportowania <br> i miętolenia.`,
        path: "",
        baner: "/baner0.png",
        style: { paddingLeft: "120px", bottom:"18%"},
        buttonStyle: {marginLeft:"32px"},
    },
    {
        title: "Zabawki BUBA",
        description: `Twój pies na pewno pokocha pluszowych przyjaciół marki <br> BUBA! Do tulenia, gryzienia, szarpania, rzucania, aportowania <br> i miętolenia.`,
        path: "",
        baner: "/baner1.png",
        style: { paddingLeft: "120px", bottom:"18%"},
        buttonStyle: {marginLeft:"32px"},
    },
    {
        title: "Zabawki BUBA",
        description: `Twój pies na pewno pokocha pluszowych przyjaciół marki <br> BUBA! Do tulenia, gryzienia, szarpania, rzucania, aportowania <br> i miętolenia.`,
        path: "",
        baner: "/baner0.png",
        style: { paddingRight: "100px", bottom:"25%", alignItems: "end", textAlign:"right"},
        buttonStyle: {},
    }
]