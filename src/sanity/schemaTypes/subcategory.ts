import { defineType, defineField } from "sanity";

export default defineType({
  name: "subcategory",
  title: "Subcategory",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({
      name: "parent",
      title: "Parent category",
      type: "reference",
      to: [{ type: "category" }],
    }),
  ],
  preview: { select: { title: "title", subtitle: "parent.title" } },
});
