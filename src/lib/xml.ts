/**
 * Minimalny, bezzależnościowy czytnik XML.
 *
 * Powstał na potrzeby komunikatów Autopay (ITN, paywayList), które są prostym
 * XML-em bez atrybutów i przestrzeni nazw. Świadomie NIE jest to pełny parser
 * XML — obsługuje dokładnie tyle, ile potrzeba: deklarację, komentarze, CDATA,
 * encje i zagnieżdżone elementy, zachowując kolejność dokumentu.
 *
 * Kolejność dokumentu jest tu kluczowa: hash Autopay liczony jest z wartości
 * liści w takiej kolejności, w jakiej występują w XML-u.
 */

export interface XmlElement {
  name:     string
  children: XmlElement[]
  text:     string
}

const NAMED_ENTITIES: Record<string, string> = {
  amp:  '&',
  lt:   '<',
  gt:   '>',
  quot: '"',
  apos: "'",
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity] ?? match
  })
}

export function parseXml(input: string): XmlElement {
  const src = input.replace(/^﻿/, '')

  const stack: XmlElement[] = []
  let root: XmlElement | null = null
  let i = 0

  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt === -1) break

    if (lt > i && stack.length > 0) {
      stack[stack.length - 1].text += decodeEntities(src.slice(i, lt))
    }

    // <?xml ... ?>
    if (src.startsWith('<?', lt)) {
      const end = src.indexOf('?>', lt)
      if (end === -1) throw new Error('Nieprawidłowy XML: niedomknięta instrukcja przetwarzania')
      i = end + 2
      continue
    }

    // <!-- ... -->
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt)
      if (end === -1) throw new Error('Nieprawidłowy XML: niedomknięty komentarz')
      i = end + 3
      continue
    }

    // <![CDATA[ ... ]]>
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt)
      if (end === -1) throw new Error('Nieprawidłowy XML: niedomknięta sekcja CDATA')
      if (stack.length > 0) stack[stack.length - 1].text += src.slice(lt + 9, end)
      i = end + 3
      continue
    }

    // <!DOCTYPE ...>
    if (src.startsWith('<!', lt)) {
      const end = src.indexOf('>', lt)
      if (end === -1) throw new Error('Nieprawidłowy XML: niedomknięta deklaracja')
      i = end + 1
      continue
    }

    const gt = src.indexOf('>', lt)
    if (gt === -1) throw new Error('Nieprawidłowy XML: niedomknięty znacznik')

    const raw = src.slice(lt + 1, gt).trim()

    // </name>
    if (raw.startsWith('/')) {
      const closing = raw.slice(1).trim()
      const open = stack.pop()
      if (!open) throw new Error('Nieprawidłowy XML: nadmiarowy znacznik zamykający')
      if (open.name !== closing) {
        throw new Error(`Nieprawidłowy XML: znacznik <${open.name}> zamknięty jako </${closing}>`)
      }
      i = gt + 1
      continue
    }

    const selfClosing = raw.endsWith('/')
    const name = (selfClosing ? raw.slice(0, -1) : raw).trim().split(/[\s/]/)[0]
    if (!name) throw new Error('Nieprawidłowy XML: pusta nazwa elementu')

    const node: XmlElement = { name, children: [], text: '' }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    } else if (root === null) {
      root = node
    } else {
      throw new Error('Nieprawidłowy XML: więcej niż jeden element główny')
    }

    if (!selfClosing) stack.push(node)
    i = gt + 1
  }

  if (root === null) throw new Error('Nieprawidłowy XML: brak elementu głównego')
  if (stack.length > 0) throw new Error(`Nieprawidłowy XML: niedomknięty element <${stack[stack.length - 1].name}>`)

  return root
}

/** Wszystkie bezpośrednie dzieci o podanej nazwie. */
export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter(child => child.name === name)
}

/** Pierwsze bezpośrednie dziecko o podanej nazwie. */
export function childNamed(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find(child => child.name === name)
}

/** Tekst pierwszego bezpośredniego dziecka o podanej nazwie (przycięty). */
export function textOf(element: XmlElement, name: string): string {
  return childNamed(element, name)?.text.trim() ?? ''
}

/** Wszystkie elementy o podanej nazwie z dowolnego poziomu zagnieżdżenia. */
export function findAll(element: XmlElement, name: string): XmlElement[] {
  const found: XmlElement[] = []
  const walk = (node: XmlElement) => {
    if (node.name === name) found.push(node)
    node.children.forEach(walk)
  }
  walk(element)
  return found
}

/**
 * Wartości liści w kolejności dokumentu — dokładnie to, z czego Autopay liczy hash.
 *
 * Pomijane są: elementy o nazwach z `skip` (wraz z poddrzewem) oraz liście
 * o pustej wartości (odpowiednik `array_filter` / pomijania nulli w SDK).
 */
export function leafValuesInDocumentOrder(element: XmlElement, skip: string[] = []): string[] {
  const skipSet = new Set(skip.map(name => name.toLowerCase()))
  const values: string[] = []

  const walk = (node: XmlElement) => {
    if (skipSet.has(node.name.toLowerCase())) return
    if (node.children.length === 0) {
      const value = node.text.trim()
      if (value !== '') values.push(value)
      return
    }
    node.children.forEach(walk)
  }

  walk(element)
  return values
}

/** Ucieczka znaków specjalnych przy budowaniu XML-a. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
