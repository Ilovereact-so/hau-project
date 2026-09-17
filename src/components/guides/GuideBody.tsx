import React from 'react'
import { PortableText, type PortableTextComponents } from '@portabletext/react'
import { portableTextBaseComponents } from '@/components/PortableTextContent'
import VideoPlayer, { type VideoValue } from './VideoPlayer'

/**
 * Renderer treści poradnika.
 *
 * To ten sam Portable Text co w Centrum pomocy (identyczna typografia, żeby
 * regulamin i poradnik nie wyglądały jak z dwóch różnych sklepów), rozszerzony
 * o jeden dodatkowy typ bloku: `videoEmbed`. Stąd rozszerzenie bazowej mapy
 * zamiast jej kopiowania — zmiana stylu akapitu w jednym miejscu przenosi się
 * na obie sekcje.
 */
const components: PortableTextComponents = {
    ...portableTextBaseComponents,
    types: {
        ...portableTextBaseComponents.types,
        videoEmbed: ({ value }) => <VideoPlayer value={value as VideoValue} className="my-8" />,
    },
}

const GuideBody = ({ value }: { value?: any[] }) => {
    if (!value || value.length === 0) return null
    return <PortableText value={value} components={components}/>
}

export default GuideBody
