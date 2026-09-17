// Querying with "sanityFetch" will keep content automatically updated
// Before using it, import and render "<SanityLive />" in your layout, see
// https://github.com/sanity-io/next-sanity#live-content-api for more information.
import { defineLive } from "next-sanity/live";
import { client } from './client'

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: false,
  browserToken: false,
  // Bez tego sanityFetch w dev (NODE_ENV !== "production") dostaje revalidate
  // undefined, więc Next nie cache'uje odpowiedzi — a implementacja live w
  // next-sanity@11 przy KAŻDYM wywołaniu robi dwa sekwencyjne requesty do
  // Sanity (najpierw "fetch-sync-tags", potem właściwe dane). Efekt: każde
  // odświeżenie strony to 2 round-tripy na zapytanie, co przy kilku
  // zapytaniach na stronę sumuje się do widocznych sekund oczekiwania.
  // fetchOptions.revalidate nadpisuje domyślne wartości (false w produkcji /
  // undefined w dev) — 60 s oznacza, że pierwszy render czeka na Sanity, a
  // kolejne przez minutę lecą z cache Next. Tagi sanity:* i tak
  // unieważniają cache, gdy treść się zmieni (SanityLive).
  fetchOptions: { revalidate: 60 },
});
