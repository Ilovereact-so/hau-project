// filter.ts
export default {
  name: 'filter',
  type: 'document',
  fields: [
    { name: 'key', type: 'string' }, // color, size, brand
    { name: 'label', type: 'string' },
    {
      name: 'type',
      type: 'string',
      options: {
        list: ['enum', 'range', 'boolean'],
      },
    },
    {
      name: 'UX_type',
      type: 'string',
      options: {
        list: ['with-image-from-variant', 'only-value-list'],
      },
    },
  ],
  preview: {
    select: {
      title: 'label',
      subtitle: 'key',
    },
  },
};
