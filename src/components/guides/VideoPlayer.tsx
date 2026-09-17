'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { urlFor } from '@/sanity/lib/image'
import { parseVideoUrl } from '@/lib/video'

export type VideoValue = {
    provider?: 'external' | 'file'
    url?: string
    /** Adres pliku zdereferencjonowany w GROQ ("fileUrl": file.asset->url). */
    fileUrl?: string
    poster?: any
    caption?: string
}

/**
 * Odtwarzacz wideo poradnika — obsługuje oba źródła zadeklarowane w schemacie
 * `videoEmbed`: link do YouTube/Vimeo albo plik wgrany do Sanity.
 *
 * Dla filmów zewnętrznych świadomie stosujemy "fasadę": dopóki widz nie kliknie
 * play, na stronie jest tylko miniatura i przycisk, a <iframe> montuje się
 * dopiero po kliknięciu. Osadzony odtwarzacz YouTube to ~1 MB skryptów na każdy
 * film — na liście poradników z kilkoma materiałami wyłożyłby stronę główną i
 * Core Web Vitals, zanim ktokolwiek cokolwiek obejrzy.
 *
 * Dla plików z Sanity używamy natywnego <video preload="metadata">, żeby
 * przeglądarka pobrała nagłówek pliku (czas trwania, wymiary), a nie całe wideo.
 */
const VideoPlayer = ({
    value,
    className,
    posterFallback,
    priority = false,
}: {
    value?: VideoValue
    className?: string
    /** Okładka poradnika — używana, gdy film nie ma własnego plakatu (typowe dla Vimeo). */
    posterFallback?: any
    priority?: boolean
}) => {
    const [isPlaying, setIsPlaying] = useState(false)
    // YouTube generuje `maxresdefault.jpg` tylko dla materiałów wgranych w
    // odpowiedniej rozdzielczości — dla reszty ten adres zwraca 404. `hqdefault`
    // istnieje zawsze, więc jest bezpiecznym zapasem po nieudanym pobraniu.
    const [thumbnailFailed, setThumbnailFailed] = useState(false)

    if (!value) return null

    const parsed = parseVideoUrl(value.url)
    const isFile = value.provider === 'file' && Boolean(value.fileUrl)
    const isExternal = value.provider !== 'file' && Boolean(parsed.embedUrl)

    if (!isFile && !isExternal) return null

    const posterSource = value.poster?.asset ? value.poster : posterFallback?.asset ? posterFallback : null
    const providerThumbnail =
        thumbnailFailed && parsed.id && parsed.provider === 'youtube'
            ? `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`
            : parsed.thumbnailUrl
    const posterUrl = posterSource ? urlFor(posterSource).width(1600).url() : providerThumbnail
    const posterAlt = value.poster?.alt || posterFallback?.alt || value.caption || 'Miniatura filmu'

    return (
        <figure className={className}>
            <div className="relative w-full aspect-video overflow-hidden rounded-[24px] bg-[#EDEDED]">
                {isFile ? (
                    <video
                        controls
                        preload="metadata"
                        playsInline
                        poster={posterUrl ?? undefined}
                        className="w-full h-full object-cover"
                    >
                        <source src={value.fileUrl} />
                        Twoja przeglądarka nie obsługuje odtwarzania wideo.
                    </video>
                ) : isPlaying ? (
                    <iframe
                        src={parsed.embedUrl ?? undefined}
                        title={value.caption || 'Film'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full border-0"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsPlaying(true)}
                        aria-label={value.caption ? `Odtwórz: ${value.caption}` : 'Odtwórz film'}
                        className="group absolute inset-0 w-full h-full cursor-pointer"
                    >
                        {posterUrl ? (
                            <Image
                                src={posterUrl}
                                alt={posterAlt}
                                fill
                                sizes="(max-width: 768px) 100vw, 900px"
                                priority={priority}
                                onError={() => setThumbnailFailed(true)}
                                className="object-cover"
                            />
                        ) : (
                            <span className="absolute inset-0 bg-fancy-black" />
                        )}
                        <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-white/95 shadow-lg transition-transform duration-300 group-hover:scale-[1.06]">
                            <Play className="w-[26px] h-[26px] sm:w-[32px] sm:h-[32px] text-fancy-black fill-main translate-x-[2px]" />
                        </span>
                    </button>
                )}
            </div>
            <div>
                {value.url && (
                    <p className="text-[#6C6C6C] text-[13px] mt-2">
                        Żródło: {value.provider === 'file' ? 'Plik wgrany do Sanity' : parsed.provider} - {value.url}                        
                    </p>
                )}
            </div>
            {value.caption && (
                <figcaption className="text-[#6C6C6C] text-[13px] mt-3 text-center">{value.caption}</figcaption>
            )}
        </figure>
    )
}

export default VideoPlayer
