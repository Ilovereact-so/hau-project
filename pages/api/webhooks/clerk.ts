import type { NextApiRequest, NextApiResponse } from "next";
import { createClerkClient } from "@clerk/backend";
import { Webhook } from "svix";

// Inicjalizacja klienta Clerk z sekretu
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end(); // tylko POST

  // Sprawdzenie nagłówków Svix
  const svix_id = req.headers["svix-id"] as string;
  const svix_timestamp = req.headers["svix-timestamp"] as string;
  const svix_signature = req.headers["svix-signature"] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).send("Missing Svix headers");
  }

  if (!process.env.CLERK_WEBHOOK_SECRET) {
    return res.status(500).send("Missing webhook secret in environment");
  }

  // Pobranie body
  const payload = JSON.stringify(req.body);

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  let evt: any;
  try {
    // Weryfikacja sygnatury
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("❌ Invalid webhook signature:", err);
    return res.status(400).send("Invalid signature");
  }

  // Obsługa eventu user.created
  if (evt.type === "user.created") {
    const userId = evt.data.id;
    try {
      await clerk.users.updateUser(userId, {
        publicMetadata: { role: "user" },
      });
      console.log(`✅ Assigned 'user' role to ${userId}`);
    } catch (err) {
      console.error("❌ Failed to update user:", err);
      return res.status(500).send("Failed to update user role");
    }
  }

  return res.status(200).send("ok");
}
