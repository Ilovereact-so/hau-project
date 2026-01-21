// filterValue.ts
export default {
  name: 'filterValue',
  type: 'document',
  fields: [
    {
      name: 'filter',
      type: 'reference',
      to: [{ type: 'filter' }],
    },
    { name: 'value', type: 'string' }, // red, XL, Nike
    { name: 'slug', type: 'slug' },
  ],
  preview: {
    select: {
      title: 'value',
      subtitle: 'filter.label',
    },
  },
};
