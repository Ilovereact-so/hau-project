/**
 * Rozpoznawanie linków do YouTube/Vimeo i budowanie z nich adresów osadzenia.
 *
 * Admin wkleja w Sanity zwykły adres z paska przeglądarki — a takich wariantów
 * jest kilka (watch?v=, youtu.be/, /embed/, /shorts/, link z listy odtwarzania,
 * link z parametrem czasu). Zamiast wymagać od niego "właściwego" formatu,
 * normalizujemy tu wszystko do jednego adresu /embed/.
 *
 * Moduł jest czysty (bez zależności od Sanity i React), więc działa tak samo na
 * serwerze przy generowaniu metadanych, jak i w komponencie klienckim.
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'unknown'

export type ParsedVideo = {
    provider: VideoProvider
    /** Identyfikator materiału u dostawcy (YouTube: 11 znaków, Vimeo: cyfry). */
    id: string | null
    /** Adres do <iframe>. null, gdy nie rozpoznaliśmy dostawcy. */
    embedUrl: string | null
    /** Miniatura wygenerowana przez dostawcę. Vimeo nie daje jej z samego ID — wtedy null. */
    thumbnailUrl: string | null
}

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/

const parseYouTube = (url: URL): string | null => {
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0]
        return id && YOUTUBE_ID.test(id) ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
        const v = url.searchParams.get('v')
        if (v && YOUTUBE_ID.test(v)) return v

        // /embed/ID, /shorts/ID, /live/ID, /v/ID
        const segments = url.pathname.split('/').filter(Boolean)
        if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
            const id = segments[1]
            return YOUTUBE_ID.test(id) ? id : null
        }
    }

    return null
}

const parseVimeo = (url: URL): string | null => {
    const host = url.hostname.replace(/^www\./, '')
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null

    // vimeo.com/123456789, vimeo.com/channels/staffpicks/123456789,
    // player.vimeo.com/video/123456789
    const segments = url.pathname.split('/').filter(Boolean)
    const numeric = segments.reverse().find((segment) => /^\d+$/.test(segment))
    return numeric ?? null
}

export const parseVideoUrl = (rawUrl?: string | null): ParsedVideo => {
    const empty: ParsedVideo = { provider: 'unknown', id: null, embedUrl: null, thumbnailUrl: null }
    if (!rawUrl) return empty

    let url: URL
    try {
        url = new URL(rawUrl.trim())
    } catch {
        return empty
    }

    const youtubeId = parseYouTube(url)
    if (youtubeId) {
        // youtube-nocookie.com — odtwarzacz nie zakłada ciasteczek śledzących,
        // dopóki widz nie kliknie play. Przy sklepie z bannerem cookies to
        // realnie mniej rzeczy do zgłoszenia w polityce prywatności.
        return {
            provider: 'youtube',
            id: youtubeId,
            embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`,
            thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`,
        }
    }

    const vimeoId = parseVimeo(url)
    if (vimeoId) {
        return {
            provider: 'vimeo',
            id: vimeoId,
            embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1&dnt=1`,
            // Miniatury Vimeo wymagają zapytania do ich API (oEmbed), czego nie
            // robimy — dla filmów z Vimeo admin powinien ustawić własny plakat.
            thumbnailUrl: null,
        }
    }

    return empty
}

/** Szacowany czas czytania na podstawie treści Portable Text. */
export const estimateReadingTime = (body?: unknown[]): number => {
    if (!body || body.length === 0) return 1

    const words = body.reduce<number>((total, block) => {
        const candidate = block as { _type?: string; children?: { text?: string }[] }
        if (candidate?._type !== 'block' || !Array.isArray(candidate.children)) return total
        const text = candidate.children.map((child) => child?.text ?? '').join(' ')
        return total + text.split(/\s+/).filter(Boolean).length
    }, 0)

    // 200 słów/min to ostrożny środek dla polskiego tekstu użytkowego.
    return Math.max(1, Math.round(words / 200))
}
