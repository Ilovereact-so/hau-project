import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId} from '../env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  // CDN (apicdn.sanity.io) jest włączony — dataset jest publiczny (pobrania
  // client-side działają bez tokena), a perspektywa 'published' nie ujawnia
  // draftów, więc CDN jest tu w pełni bezpieczny i globalnie szybszy niż
  // odpytywanie origin *.api.sanity.io. Podgląd draftów i tak idzie przez
  // serverowy sanityFetch (lib/live.ts), który sam schodzi z CDN gdy trzeba.
  useCdn: true,
  perspective: 'published',
})
