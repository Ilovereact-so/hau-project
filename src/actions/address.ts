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
  apartment_number?:string
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
    apartment_number: r.apartment_number || undefined,
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
        // null, nie undefined — undefined drizzle pomija, więc wyczyszczonego
        // numeru lokalu nie dało się usunąć z zapisanego adresu.
        apartment_number: address.apartment_number || null,
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
      apartment_number: address.apartment_number || undefined,
      postalCode: address.postalCode,
      country:    'PL',
    })
  }
}

// ─── edycja z profilu (/profile/account) ──────────────────────────────────────

export type ProfileAddressSection = 'contact' | 'address'

export type SaveProfileAddressResult =
  | { ok: true; address: SavedAddress }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof SavedAddress, string>> }

const EMPTY: SavedAddress = {
  firstName: '', lastName: '', email: '', phone: '',
  street: '', apartment_number: undefined, city: '', postalCode: '', country: 'PL',
}

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Zapis jednej sekcji z profilu: „Dane odbiorcy” albo „Adres dostawy”.
 * Druga sekcja zostaje bez zmian (dopóki nie istnieje — pusta), więc zapis
 * samych danych kontaktowych nie wymaga podawania adresu.
 */
export async function saveProfileAddress(
  section: ProfileAddressSection,
  input: Partial<SavedAddress>,
): Promise<SaveProfileAddressResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Sesja wygasła — zaloguj się ponownie.' }

  const current = (await getSavedAddress()) ?? EMPTY
  const next: SavedAddress = { ...current }
  const fieldErrors: Partial<Record<keyof SavedAddress, string>> = {}

  if (section === 'contact') {
    next.firstName = clean(input.firstName, 128)
    next.lastName = clean(input.lastName, 128)
    next.email = clean(input.email, 256).toLowerCase()
    next.phone = clean(input.phone, 32).replace(/[^\d+ ]/g, '')
    if (!next.firstName) fieldErrors.firstName = 'Podaj imię'
    if (!next.lastName) fieldErrors.lastName = 'Podaj nazwisko'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) fieldErrors.email = 'Nieprawidłowy e-mail'
    if (next.phone.replace(/\D/g, '').length < 9) fieldErrors.phone = 'Podaj numer telefonu (9 cyfr)'
  } else {
    next.street = clean(input.street, 256)
    next.apartment_number = clean(input.apartment_number, 64) || undefined
    next.city = clean(input.city, 128)
    next.postalCode = clean(input.postalCode, 16)
    if (!next.street) fieldErrors.street = 'Podaj ulicę i numer'
    if (!next.city) fieldErrors.city = 'Podaj miejscowość'
    if (!/^\d{2}-\d{3}$/.test(next.postalCode)) fieldErrors.postalCode = 'Format: 00-000'
  }

  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Popraw zaznaczone pola.', fieldErrors }

  try {
    await upsertSavedAddress(next)
    return { ok: true, address: next }
  } catch (err) {
    console.error('[profile] zapis adresu:', err)
    return { ok: false, error: 'Nie udało się zapisać danych. Spróbuj ponownie.' }
  }
}
