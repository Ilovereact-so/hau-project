import { defineType, defineField } from "sanity";

export default defineType({
  name: "optionList",
  title: "Option List",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "type", title: "Type", type: "string", description: "np. 'color' lub 'size'" }),
    defineField({
      name: "values",
      title: "Values",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "label", title: "Label", type: "string" },
            { name: "value", title: "Value", type: "string" },
            { name: "hex", title: "HEX (opcjonalnie)", type: "string" },
            { name: "image", title: "Image (opcjonalnie)", type: "image" },
          ],
        },
      ],
    }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
  ],
  preview: { select: { title: "title", subtitle: "type" } },
});
