import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

/**
 * Domyślny obrazek podglądu (Facebook, Messenger, LinkedIn, X) dla stron,
 * które nie mają własnego zdjęcia. Generowany przez Next przy budowaniu, więc
 * nie trzeba trzymać gotowej grafiki w repo.
 *
 * FONT: `next/og` ma wbudowane tylko Noto Sans w podzbiorze „latin”, w którym
 * NIE MA polskich znaków — ł, ś, ą wychodziły jako puste prostokąty. Dlatego
 * ładujemy podzbiór Poppinsa (tego samego kroju co sklep) z `_og-fonts`.
 * Gdyby pliku zabrakło, wracamy do fontu domyślnego zamiast wywracać budowanie.
 */
export const alt = `${SITE_NAME} — sklep z akcesoriami dla psa`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONT_DIR = join(process.cwd(), 'src', 'app', '_og-fonts')

async function loadFonts() {
  try {
    const [regular, bold] = await Promise.all([
      readFile(join(FONT_DIR, 'Poppins-Regular.subset.ttf')),
      readFile(join(FONT_DIR, 'Poppins-Bold.subset.ttf')),
    ])
    return [
      { name: 'Poppins', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Poppins', data: bold, weight: 700 as const, style: 'normal' as const },
    ]
  } catch (error) {
    console.error('[og] Nie udało się wczytać fontu podglądu:', error)
    return undefined
  }
}

export default async function OpengraphImage() {
  const fonts = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 60%, #6EB0A6 100%)',
          color: '#ffffff',
          fontFamily: fonts ? 'Poppins' : undefined,
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: '-4px' }}>{SITE_NAME}</div>
        <div style={{ fontSize: 40, marginTop: 8, color: '#e2f3f0' }}>sklep z akcesoriami dla psa</div>
        <div style={{ fontSize: 26, marginTop: 32, color: '#cfcfcf', maxWidth: 900, lineHeight: 1.4 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size, ...(fonts ? { fonts } : {}) },
  )
}
