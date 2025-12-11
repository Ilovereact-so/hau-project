import { createClient } from "@sanity/client";

export const sanityClient = createClient({
projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
dataset: "production",
apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-11",
useCdn: false,
token: process.env.SANITY_API_TOKEN!, // <-- keep this secret on the server
perspective: 'published', 
});


// lightweight read-only client for client (no token)
export const sanityClientReadOnly =  createClient({
projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
dataset: "production",
apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-11",
useCdn: false,
});