import { TrolleyIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const productType = defineType({
    name:'product',
    title:"Product",
    type:'document',
    icon:TrolleyIcon,
    fields:[
        defineField({
            name:"name",
            title:"Product name",
            type:'string',
            validation:(Rule)=>Rule.required(),
        }),
        defineField({
            name:'subname',
            title:"Product subname",
            type:"string"
        }),
        defineField({
            name:'slug',
            title:'Slug',
            type:'slug',
            options:{
                source:'name',
                maxLength: 96,
            },
            validation: (Rule)=> Rule.required(),
        }),
        defineField({
            name:'images',
            title:"Product Images",
            type: "array",
            of: [{type: "image", options: {hotspot:true}}],
        }),
        defineField({
            name:'intro',
            title:"Product Intro",
            type:"string"
        }),
        defineField({
            name:'description',
            title:"Description",
            type:"string"
        }),
        defineField({
            name:'discount',
            title:"Discount Price",
            type:"number",
            validation: (Rule) => Rule.required()
        }),
        defineField({
            name:'price',
            title:"Price",
            type:"number",
            validation: (Rule) => Rule.required()
        }),
        defineField({
            name:'categories',
            title:"Categories",
            type:"array",
            of:[{type:"reference", to:{type:"category"}}]
        }),
        defineField({
            name:'stock',
            title:"Stock",
            type:"number",
            validation: (Rule) => Rule.min(0)
        }),
        defineField({
            name:'status',
            title:"Status",
            type:"string",
            options:{
                list:[
                    {title:"New", value: "new"},
                    {title:"Hot", value: "hot"},
                    {title:"Sale", value: "sale"},

                ]
            }
        }),
        defineField({
            name:'variant',
            title:"Product Type",
            type:"string",
            options:{
                list:[
                    {title:"Miski dla psa", value: "miski_dla_psa"},
                    {title:"Maty pod miski dla psa", value: "maty_pod_miski_dla_psa"},
                ]
            }
        }),
    ],
    preview:{
        select:{
            title:"name",
            media:"images",
            subtitles:"price"
        },
        prepare(selection){
            const {title, subtitles, media} = selection
            const image=media && media[0]
            return {
                title: title,
                subtitle: `$${subtitles}`,
                media: image
            }
        }
    }
})