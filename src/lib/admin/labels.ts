// Wspólne etykiety statusów dla panelu admina (spójne ze sklepem).
// Plik bez zależności serwerowych — używany i w komponentach klienckich.

import type { OrderStatus } from '@/db/schema'

export const OrderStatusLabel: Record<string, string> = {
  pending: 'Oczekujące',
  awaiting_payment: 'Oczekuje na płatność',
  paid: 'Opłacone',
  processing: 'W realizacji',
  shipped: 'Wysłane',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
  refunded: 'Zwrócone',
}

export const ORDER_STATUSES = Object.keys(OrderStatusLabel)

/**
 * Dozwolone ręczne przejścia statusu zamówienia. Statusy płatności
 * (`awaiting_payment` → `paid`) ustawiają wyłącznie webhooki operatorów.
 */
export const ORDER_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['cancelled'],
  awaiting_payment: ['cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
}

export const PaymentMethodLabel: Record<string, string> = {
  przelewy24: 'Przelewy24',
  autopay: 'Autopay',
  cod: 'Za pobraniem',
}

export const PaymentProviderLabel: Record<string, string> = {
  przelewy24: 'Przelewy24',
  autopay: 'Autopay',
}

export const ShipmentStatusLabel: Record<string, string> = {
  created: 'Przesyłka utworzona',
  picked_up: 'Odebrana przez kuriera',
  in_transit: 'W drodze',
  out_for_delivery: 'W doręczeniu',
  delivered: 'Doręczona',
  failed: 'Nieudane doręczenie',
  returned: 'Zwrócona do nadawcy',
}

export const PaymentTxLabel: Record<string, string> = {
  pending: 'Oczekująca',
  success: 'Zaksięgowana',
  failed: 'Nieudana',
  expired: 'Wygasła',
  refunded: 'Zwrócona',
}

export const PublishStateLabel: Record<string, string> = {
  published: 'W sklepie',
  changed: 'Zmiany w szkicu',
  draft: 'Szkic',
}

export const ShippingTypeLabel: Record<string, string> = {
  kurier: 'Kurier',
  automat: 'Paczkomat / punkt',
}
