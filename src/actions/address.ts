'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { savedAddresses } from '@/db/schema'
import { eq } from 'drizzle-orm'

export interface SavedAddress {
  firstName:  string
  lastName:   string
  email:      string
  phone:      string
  street:     string
  city:       string
  postalCode: string
  country:    'PL'
}

export async function getSavedAddress(): Promise<SavedAddress | null> {
  const { userId } = await auth()
  if (!userId) return null

  const rows = await db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, userId))
    .limit(1)

  if (!rows[0]) return null

  const r = rows[0]
  return {
    firstName:  r.firstName,
    lastName:   r.lastName,
    email:      r.email,
    phone:      r.phone,
    street:     r.street,
    city:       r.city,
    postalCode: r.postalCode,
    country:    'PL',
  }
}

export async function upsertSavedAddress(address: SavedAddress): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const existing = await db
    .select({ id: savedAddresses.id })
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, userId))
    .limit(1)

  if (existing[0]) {
    await db
      .update(savedAddresses)
      .set({
        firstName:  address.firstName,
        lastName:   address.lastName,
        email:      address.email,
        phone:      address.phone,
        street:     address.street,
        city:       address.city,
        postalCode: address.postalCode,
      })
      .where(eq(savedAddresses.userId, userId))
  } else {
    await db.insert(savedAddresses).values({
      id:         crypto.randomUUID(),
      userId,
      firstName:  address.firstName,
      lastName:   address.lastName,
      email:      address.email,
      phone:      address.phone,
      street:     address.street,
      city:       address.city,
      postalCode: address.postalCode,
      country:    'PL',
    })
  }
}
