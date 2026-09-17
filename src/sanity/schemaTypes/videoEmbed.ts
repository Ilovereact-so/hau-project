import { defineField, defineType } from 'sanity'

/**
 * Wspólny blok wideo używany w dwóch miejscach poradnika:
 *  - `heroVideo` — film otwierający wpis (nad treścią),
 *  - jako element `body` — film wstawiony w środek artykułu.
 *
 * Świadomie NIE jest to osobny typ dokumentu, tylko obiekt osadzany, bo film
 * nie ma sensu w oderwaniu od poradnika, w którym siedzi.
 *
 * Dwa źródła (`provider`):
 *  - `external` — link do YouTube/Vimeo. Domyślne i zalecane: zero transferu po
 *    stronie Sanity, adaptacyjna jakość, działające napisy.
 *  - `file` — plik wgrany do Sanity. Wygodne przy krótkich klipach bez konta na
 *    YouTube, ale każde odtworzenie zjada transfer projektu Sanity, a plik leci
 *    do przeglądarki w jednej, stałej jakości. Stąd ostrzeżenie w opisie pola.
 *
 * `hidden` na polach zależnych od `provider` to nie kosmetyka — bez tego admin
 * widzi jednocześnie pole na link i na plik i nie ma jak zgadnąć, które z nich
 * faktycznie zadziała.
 */
export default defineType({
  name: 'videoEmbed',
  title: 'Film',
  type: 'object',
  fields: [
    defineField({
      name: 'provider',
      title: 'Skąd film',
      type: 'string',
      options: {
        list: [
          { title: 'Link (YouTube / Vimeo)', value: 'external' },
          { title: 'Plik wgrany do Sanity', value: 'file' },
        ],
        layout: 'radio',
      },
      initialValue: 'external',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'Link do filmu',
      description:
        'Wklej zwykły adres z paska przeglądarki — np. https://www.youtube.com/watch?v=XXXX, https://youtu.be/XXXX lub https://vimeo.com/123456789.',
      type: 'url',
      hidden: ({ parent }) => parent?.provider !== 'external',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { provider?: string } | undefined
          if (parent?.provider !== 'external') return true
          if (!value) return 'Podaj link do filmu (YouTube lub Vimeo).'
          return true
        }),
    }),
    defineField({
      name: 'file',
      title: 'Plik wideo',
      description:
        'MP4 lub WebM. Uwaga: pliki wgrane tutaj obciążają transfer Twojego projektu Sanity i lecą do widza w jednej, stałej jakości — przy dłuższych materiałach lepiej wrzucić film na YouTube i podać link.',
      type: 'file',
      options: { accept: 'video/mp4,video/webm,video/quicktime' },
      hidden: ({ parent }) => parent?.provider !== 'file',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { provider?: string } | undefined
          if (parent?.provider !== 'file') return true
          if (!value) return 'Wgraj plik wideo albo przełącz się na link.'
          return true
        }),
    }),
    defineField({
      name: 'poster',
      title: 'Miniatura (plakat)',
      description:
        'Klatka pokazywana przed uruchomieniem filmu. Przy YouTube/Vimeo pobieramy ją automatycznie, więc to pole jest potrzebne głównie dla wgranych plików — albo gdy chcesz podmienić domyślną miniaturę.',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Tekst alternatywny',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'caption',
      title: 'Podpis pod filmem',
      type: 'string',
    }),
  ],
  preview: {
    select: { provider: 'provider', url: 'url', caption: 'caption', media: 'poster' },
    prepare({ provider, url, caption, media }) {
      return {
        title: caption || 'Film',
        subtitle: provider === 'file' ? 'Plik wgrany do Sanity' : url || 'Brak linku',
        media,
      }
    },
  },
})
