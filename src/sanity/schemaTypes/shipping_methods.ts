import { defineType, defineField } from "sanity";

export default defineType({
    name: "shipping_methods",
    title: "Shipping Methods",
    type: "document",
    fields: [
        defineField({name: "name", title: "Name", type:"string", validation: (Rule) => Rule.required()}),
        defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "name" } }),
        defineField({ name: "internal_price", title: "Internal Price", type: "number"}),
        defineField({ name: "furgonetka_service_id", title: "furgonetka_service_id", type: "string"}),
        defineField({ name: 'type', type: 'string', options: {list: ['kurier', 'automat'],},}),
        defineField({ name: "active", title: "Active", type: "boolean"}),

    ],
    preview: {
    select: {
      title: "name",
    },
    prepare({ title}) {
      return {
        title: title || "Brak tytułu",
      };
    },
  },
})