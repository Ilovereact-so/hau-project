// src/app/api/webhooks/clerk/route.ts
import { createClerkClient } from "@clerk/backend";
import { Webhook } from "svix";
export const runtime = "nodejs";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function POST(req: Request) {
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  if (!process.env.CLERK_WEBHOOK_SECRET) {
    return new Response("Missing webhook secret in environment", { status: 500 });
  }

  const payload = await req.text();
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("❌ Invalid webhook signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created") {
    const userId = evt.data.id;
    try {
      await clerk.users.updateUser(userId, {
        publicMetadata: { role: "user" },
      });
      console.info(`✅ Assigned 'user' role to ${userId}`);
    } catch (err) {
      console.error("❌ Failed to update user:", err);
      return new Response("Failed to update user role", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}
