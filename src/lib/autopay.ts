import 'server-only'
import { createHash, randomBytes } from 'crypto'
import {
  parseXml,
  childNamed,
  childrenNamed,
  findAll,
  textOf,
  leafValuesInDocumentOrder,
  escapeXml,
  type XmlElement,
} from '@/lib/xml'

/**
 * Integracja z bramką Autopay (dawniej Blue Media).
 *
 * Zasady wzięte ze specyfikacji bramki i zweryfikowane na fixture'ach
 * referencyjnego SDK (bluepayment-plugin/bm-sdk):
 *
 *  - transakcja startuje POST-em `application/x-www-form-urlencoded` na /payment,
 *  - hash = ALGO( wartości WSZYSTKICH wysyłanych pól, w kolejności ze specyfikacji,
 *    złączone separatorem, + klucz współdzielony na końcu ),
 *  - ITN przychodzi POST-em jako pole `transactions` = base64(XML); hash liczony
 *    jest z wartości liści XML-a w kolejności dokumentu, z pominięciem <hash>,
 *  - odpowiedź na ITN to XML <confirmationList> z własnym hashem.
 */

// ─── konfiguracja ─────────────────────────────────────────────────────────────

const SERVICE_ID = (process.env.AUTOPAY_SERVICE_ID ?? '').trim()
const HASH_KEY   = (process.env.AUTOPAY_HASH_KEY   ?? '').trim()
const SEPARATOR  = process.env.AUTOPAY_HASH_SEPARATOR ?? '|'
const ALGO       = (process.env.AUTOPAY_HASH_ALGO ?? 'sha256').trim().toLowerCase()

const ENVIRONMENT = (process.env.AUTOPAY_ENV ?? 'test').trim().toLowerCase() === 'production'
  ? 'production'
  : 'test'

const BASE_URL = (
  process.env.AUTOPAY_BASE_URL?.trim() ||
  (ENVIRONMENT === 'production' ? 'https://pay.autopay.eu' : 'https://testpay.autopay.eu')
).replace(/\/+$/, '')

/**
 * Dynamiczny adres powrotu (`ReturnURL`) musi zostać włączony przez Autopay dla
 * konkretnego serwisu. Domyślnie wyłączony — powrót obsługuje adres z panelu.
 */
const SEND_RETURN_URL = process.env.AUTOPAY_SEND_RETURN_URL === 'true'

/**
 * Zapisane karty („płatność kartą One Click”, kanał 1503). Wymaga włączenia
 * kanału 1503 dla serwisu po stronie Autopay. Domyślnie wyłączone — bez flagi
 * kasa nie proponuje zapisu karty ani płatności zapisaną kartą (karty już
 * zapisane nadal widać i da się je usunąć w profilu).
 */
export const AUTOPAY_RECURRING_ENABLED = process.env.AUTOPAY_RECURRING_ENABLED === 'true'

/**
 * BLIK-0 — kod zbierany w checkoucie i wysyłany jako `AuthorizationCode`.
 * Domyślnie włączone; ustaw `false`, żeby wrócić do przekierowania na Autopay.
 */
export const AUTOPAY_BLIK0_ENABLED = process.env.AUTOPAY_BLIK0_ENABLED !== 'false'

/**
 * Formularz karty Autopay osadzony w ramce na naszej stronie (`ScreenType=IFRAME`).
 * Domyślnie włączone; przy błędzie bramki i tak schodzimy do przekierowania.
 */
export const AUTOPAY_CARD_IFRAME_ENABLED = process.env.AUTOPAY_CARD_IFRAME_ENABLED !== 'false'

/** Identyfikatory kanałów, które obsługujemy w specjalny sposób. */
export const AUTOPAY_BLIK_GATEWAY_ID = 509
export const AUTOPAY_CARD_GATEWAY_ID = 1500
/**
 * „Płatność kartą One Click” — kanał płatności automatycznych. Pierwsza
 * płatność (`INIT_WITH_PAYMENT`, z 3-D Secure) zapisuje kartę w Autopay, kolejne
 * (`MANUAL` + `ClientHash`) obciążają zapisaną kartę. Tak samo robi oficjalna
 * wtyczka Autopay do Magento (`ONECLICK_GATEWAY_ID = 1503`).
 */
export const AUTOPAY_ONECLICK_GATEWAY_ID = 1503

export const AUTOPAY_PAYMENT_URL   = `${BASE_URL}/payment`
const AUTOPAY_PAYWAY_LIST_URL      = `${BASE_URL}/paywayList`

export function isAutopayConfigured(): boolean {
  return SERVICE_ID !== '' && HASH_KEY !== ''
}

export function autopayEnvironment(): { environment: 'test' | 'production'; baseUrl: string; serviceId: string } {
  return { environment: ENVIRONMENT, baseUrl: BASE_URL, serviceId: SERVICE_ID }
}

function assertConfigured(): void {
  if (!isAutopayConfigured()) {
    throw new Error('Autopay nie jest skonfigurowany — brak AUTOPAY_SERVICE_ID lub AUTOPAY_HASH_KEY.')
  }
}

// ─── hash ─────────────────────────────────────────────────────────────────────

/**
 * Hash Autopay: wartości złączone separatorem, na końcu klucz współdzielony.
 * Puste wartości są pomijane (tak jak pola nieustawione w SDK).
 */
export function autopayHash(values: Array<string | undefined | null>): string {
  const parts = values
    .filter((value): value is string => value !== undefined && value !== null && value !== '')
  return createHash(ALGO).update([...parts, HASH_KEY].join(SEPARATOR), 'utf8').digest('hex')
}

// ─── identyfikator zamówienia ─────────────────────────────────────────────────

/**
 * `OrderID` w Autopay ma limit 32 znaków, a nasze `orders.id` to UUID (36 znaków).
 * Wysyłamy UUID bez myślników (32 znaki) i odtwarzamy go przy odbiorze ITN.
 */
export function toAutopayOrderId(orderId: string): string {
  return orderId.replace(/-/g, '')
}

export function fromAutopayOrderId(autopayOrderId: string): string {
  const value = autopayOrderId.trim()
  if (/^[0-9a-fA-F]{32}$/.test(value)) {
    return [
      value.slice(0, 8),
      value.slice(8, 12),
      value.slice(12, 16),
      value.slice(16, 20),
      value.slice(20),
    ].join('-').toLowerCase()
  }
  return value
}

// ─── rozpoczęcie transakcji ───────────────────────────────────────────────────

/**
 * Kolejność pól transakcji wg specyfikacji bramki (identyczna jak `@AccessorOrder`
 * w referencyjnym SDK). Hash liczony jest z wartości pól obecnych w tej kolejności.
 *
 * Pola płatności automatycznych (`RecurringAcceptanceState`, `RecurringAction`,
 * `ClientHash` — pozycje 35–37 specyfikacji) stoją PRZED `AuthorizationCode`
 * (40), `ScreenType` (41) i `ReturnURL` (45) — tak jak w oficjalnej wtyczce
 * Autopay do Magento. Wcześniej były na końcu listy, więc każda transakcja
 * z zapisem karty miałaby błędny hash.
 */
const TRANSACTION_FIELD_ORDER = [
  'ServiceID',
  'OrderID',
  'Amount',
  'Description',
  'GatewayID',
  'Currency',
  'CustomerEmail',
  'CustomerNRB',
  'TaxCountry',
  'CustomerIP',
  'Title',
  'ReceiverName',
  'ValidityTime',
  'LinkValidityTime',
  'RecurringAcceptanceState',
  'RecurringAction',
  'ClientHash',
  'AuthorizationCode',
  'ScreenType',
  'BlikUIDKey',
  'BlikUIDLabel',
  'BlikAMKey',
  'ReturnURL',
  'DefaultRegulationAcceptanceState',
  'DefaultRegulationAcceptanceID',
  'DefaultRegulationAcceptanceTime',
  'ReceiverNRB',
  'ReceiverAddress',
  'RemoteID',
  'BankHref',
] as const

type TransactionField = (typeof TRANSACTION_FIELD_ORDER)[number]

export type AutopayRecurringAction =
  | 'INIT_WITH_PAYMENT'
  | 'INIT_WITH_REFUND'
  | 'AUTO'
  | 'MANUAL'
  | 'DEACTIVATE'

/** `IFRAME` = formularz kanału renderowany w ramce na naszej stronie. */
export type AutopayScreenType = 'IFRAME' | 'FULL'

export interface AutopayTransactionParams {
  /** Nasze `orders.id` (UUID) — konwersja do 32 znaków dzieje się tutaj. */
  orderId:        string
  /** Kwota w formacie "0.00". */
  amount:         string
  description?:   string
  customerEmail:  string
  currency?:      string
  /** Wybrany kanał płatności. Pominięty = Autopay pokaże własną listę metod. */
  gatewayId?:     number
  customerIp?:    string
  title?:         string
  /** BLIK-0: 6-cyfrowy kod z aplikacji bankowej. */
  authorizationCode?: string
  /** Karty: `IFRAME` osadza formularz Autopay na naszej stronie. */
  screenType?:    AutopayScreenType
  /** Dynamiczny adres powrotu — wysyłany tylko gdy AUTOPAY_SEND_RETURN_URL=true. */
  returnUrl?:     string
  /**
   * Ważność transakcji = termin płatności zamówienia. Po nim bramka nie
   * przyjmie wpłaty (zamówienie jest już anulowane). Format bramki:
   * `YYYY-MM-DD HH:MM:SS` w czasie polskim — patrz `autopayDateTime`.
   */
  validityTime?:  Date
  /**
   * Zapisane karty (kanał 1503) — tylko gdy AUTOPAY_RECURRING_ENABLED=true.
   * Zapis nowej karty: `ACCEPTED` + `INIT_WITH_PAYMENT`; płatność zapisaną
   * kartą: `MANUAL` + `clientHash`.
   */
  recurringAcceptanceState?: 'ACCEPTED'
  recurringAction?: AutopayRecurringAction
  clientHash?:      string
}

export interface AutopayTransactionRequest {
  /** Adres akcji formularza. */
  url:    string
  /** Pola do wysłania POST-em jako application/x-www-form-urlencoded. */
  fields: Record<string, string>
}

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
}

/** Opis transakcji: bez znaków diakrytycznych, maks. 79 znaków (limit bramki). */
export function normalizeDescription(description: string): string {
  return description
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, char => DIACRITICS[char] ?? char)
    .replace(/[^A-Za-z0-9 .,\-_/#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 79)
}

/**
 * Data w formacie bramki (`YYYY-MM-DD HH:MM:SS`, czas polski) — tak samo jak
 * w oficjalnej wtyczce Autopay do Magento (`ValidityTime` w strefie Europe/Warsaw).
 */
export function autopayDateTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function buildTransactionRequest(params: AutopayTransactionParams): AutopayTransactionRequest {
  assertConfigured()

  if (!/^\d+\.\d{2}$/.test(params.amount)) {
    throw new Error(`Autopay: nieprawidłowy format kwoty "${params.amount}" — wymagane "0.00".`)
  }

  const orderId = toAutopayOrderId(params.orderId)
  if (orderId.length > 32) {
    throw new Error(`Autopay: OrderID "${orderId}" przekracza limit 32 znaków.`)
  }

  const values: Partial<Record<TransactionField, string>> = {
    ServiceID:     SERVICE_ID,
    OrderID:       orderId,
    Amount:        params.amount,
    Description:   params.description ? normalizeDescription(params.description) : undefined,
    GatewayID:     params.gatewayId !== undefined ? String(params.gatewayId) : undefined,
    Currency:      params.currency ?? 'PLN',
    CustomerEmail: params.customerEmail,
    CustomerIP:    params.customerIp,
    Title:         params.title ? normalizeDescription(params.title) : undefined,
    AuthorizationCode: params.authorizationCode,
    ScreenType:        params.screenType,
    ReturnURL:     SEND_RETURN_URL ? params.returnUrl : undefined,
    ValidityTime:  params.validityTime ? autopayDateTime(params.validityTime) : undefined,
  }

  if (AUTOPAY_RECURRING_ENABLED && params.recurringAction) {
    values.RecurringAcceptanceState = params.recurringAcceptanceState
    values.RecurringAction          = params.recurringAction
    values.ClientHash               = params.clientHash
  }

  const ordered = TRANSACTION_FIELD_ORDER
    .filter(field => values[field] !== undefined && values[field] !== '')
    .map(field => [field, values[field] as string] as const)

  const hash = autopayHash(ordered.map(([, value]) => value))

  return {
    url:    AUTOPAY_PAYMENT_URL,
    fields: { ...Object.fromEntries(ordered), Hash: hash },
  }
}

// ─── transakcja "w tle" (BLIK-0, formularz karty w iframe) ────────────────────

export interface AutopayContinueAccepted {
  ok:          true
  status:      string   // np. PENDING, SUCCESS
  /**
   * BLIK-0: strona oczekiwania; karta: URL do <iframe> (formularz albo 3-D Secure).
   * `null` — płatność zapisaną kartą przeszła bez dodatkowej weryfikacji
   * (wynik i tak rozstrzyga ITN).
   */
  redirectUrl: string | null
  orderId:     string   // UUID zamówienia
  remoteId:    string
}

export interface AutopayContinueRejected {
  ok:           false
  confirmation: string  // NOTCONFIRMED
  reason:       string  // np. WRONG_TICKET, ALIAS_DECLINED
  orderId:      string
}

export type AutopayContinueResult = AutopayContinueAccepted | AutopayContinueRejected

/** Powody odrzucenia przedtransakcji przetłumaczone na komunikat dla klienta. */
const REJECTION_MESSAGES: Record<string, string> = {
  WRONG_TICKET:    'Kod BLIK jest nieprawidłowy. Wygeneruj nowy w aplikacji banku.',
  TICKET_EXPIRED:  'Kod BLIK wygasł. Wygeneruj nowy w aplikacji banku.',
  TICKET_USED:     'Ten kod BLIK został już użyty. Wygeneruj nowy.',
  ALIAS_DECLINED:  'Bank odrzucił płatność.',
  ALIAS_NOT_FOUND: 'Nie znaleziono powiązania z aplikacją banku.',
}

export function describeRejection(reason: string): string {
  return REJECTION_MESSAGES[reason.toUpperCase()] ?? 'Płatność została odrzucona przez bramkę.'
}

/**
 * Uruchamia transakcję bez przekierowania przeglądarki (tzw. przedtransakcja).
 *
 * Używane w dwóch przypadkach:
 *  - **BLIK-0** — kod z aplikacji banku zbieramy u siebie i wysyłamy jako
 *    `AuthorizationCode`; klient potwierdza płatność w aplikacji, my czekamy na ITN;
 *  - **karta z `ScreenType: 'IFRAME'`** — Autopay zwraca URL formularza karty,
 *    który osadzamy w ramce na naszej stronie (dane karty nigdy nie trafiają
 *    na nasz serwer, więc sklep zostaje poza zakresem PCI DSS).
 *
 * Wywołanie serwer-serwer z nagłówkiem `BmHeader: pay-bm-continue-transaction-url`.
 */
export async function startTransactionInBackground(
  params: AutopayTransactionParams,
  signal?: AbortSignal,
): Promise<AutopayContinueResult> {
  const { url, fields } = buildTransactionRequest(params)

  const response = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'BmHeader':     'pay-bm-continue-transaction-url',
    },
    body:  new URLSearchParams(fields),
    cache: 'no-store',
    signal,
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Autopay: HTTP ${response.status} — ${text.slice(0, 200)}`)
  }

  if (!text.includes('<transaction')) {
    throw new Error(`Autopay: nieoczekiwana odpowiedź bramki — ${text.slice(0, 200)}`)
  }

  const root = parseXml(text)

  const errorNode = findAll(root, 'error')[0]
  if (errorNode) {
    throw new Error(`Autopay: błąd bramki — ${textOf(errorNode, 'name') || errorNode.text.trim()}`)
  }

  const receivedHash = textOf(root, 'hash')
  if (!receivedHash) throw new Error('Autopay: odpowiedź bramki bez pola <hash>.')

  const expectedHash = autopayHash(leafValuesInDocumentOrder(root, ['hash']))
  if (!timingSafeEquals(expectedHash, receivedHash)) {
    throw new Error('Autopay: nieprawidłowy hash odpowiedzi bramki.')
  }

  const orderId = fromAutopayOrderId(textOf(root, 'orderID'))
  const confirmation = textOf(root, 'confirmation')

  if (confirmation && confirmation.toUpperCase() !== 'CONFIRMED') {
    return { ok: false, confirmation, reason: textOf(root, 'reason'), orderId }
  }

  const redirectUrl = textOf(root, 'redirecturl')
  // Płatność zapisaną kartą może przejść od razu (bez 3-D Secure) — wtedy
  // bramka zwraca sam status (`paymentStatus`), bez adresu. Każdy inny tryb
  // (BLIK-0, formularz karty) bez adresu to błąd.
  const status = textOf(root, 'status') || textOf(root, 'paymentStatus')
  if (!redirectUrl && !status) {
    throw new Error('Autopay: odpowiedź bramki bez pola <redirecturl>.')
  }

  return {
    ok:       true,
    status,
    redirectUrl: redirectUrl || null,
    orderId,
    remoteId: textOf(root, 'remoteID'),
  }
}

// ─── powrót z płatności ───────────────────────────────────────────────────────

/** Adres powrotu dostaje GET-em ServiceID, OrderID i Hash = ALGO(ServiceID|OrderID|klucz). */
export function verifyReturnHash(serviceId: string, orderId: string, hash: string): boolean {
  if (!isAutopayConfigured()) return false
  if (serviceId !== SERVICE_ID) return false
  return timingSafeEquals(autopayHash([serviceId, orderId]), hash)
}

function timingSafeEquals(a: string, b: string): boolean {
  const left  = a.toLowerCase()
  const right = (b ?? '').toLowerCase()
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

// ─── lista kanałów płatności (paywayList) ─────────────────────────────────────

export interface AutopayGateway {
  gatewayID:    number
  gatewayName:  string
  gatewayType:  string
  bankName:     string
  iconURL:      string
}

/**
 * Pobiera listę aktywnych kanałów płatności.
 * Wymaga włączonej usługi white-label po stronie Autopay.
 */
export async function fetchGateways(signal?: AbortSignal): Promise<AutopayGateway[]> {
  assertConfigured()

  const messageId = randomBytes(16).toString('hex') // 32 znaki
  const body = new URLSearchParams({
    ServiceID: SERVICE_ID,
    MessageID: messageId,
    Hash:      autopayHash([SERVICE_ID, messageId]),
  })

  const response = await fetch(AUTOPAY_PAYWAY_LIST_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'BmHeader':     'pay-bm',
    },
    body,
    cache: 'no-store',
    signal,
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Autopay paywayList: HTTP ${response.status} — ${text.slice(0, 200)}`)
  }

  const root = parseXml(text)

  const error = childNamed(root, 'error') ?? findAll(root, 'error')[0]
  if (error) {
    const name = textOf(error, 'name') || error.text.trim()
    throw new Error(`Autopay paywayList: błąd bramki — ${name || 'nieznany'}`)
  }

  return findAll(root, 'gateway')
    .map(gateway => ({
      gatewayID:   Number.parseInt(textOf(gateway, 'gatewayID'), 10),
      gatewayName: textOf(gateway, 'gatewayName'),
      gatewayType: textOf(gateway, 'gatewayType'),
      bankName:    textOf(gateway, 'bankName'),
      iconURL:     textOf(gateway, 'iconURL'),
    }))
    .filter(gateway => Number.isFinite(gateway.gatewayID))
}

// ─── ITN ──────────────────────────────────────────────────────────────────────

export type AutopayPaymentStatus = 'SUCCESS' | 'FAILURE' | 'PENDING'

export interface AutopayItnTransaction {
  orderId:              string   // UUID zamówienia (po konwersji z OrderID)
  autopayOrderId:       string   // OrderID tak jak przyszedł z Autopay
  remoteId:             string
  amount:               string
  currency:             string
  gatewayId:            string
  paymentDate:          string
  paymentStatus:        AutopayPaymentStatus
  paymentStatusDetails: string
  /** Token płatności automatycznej, jeśli usługa jest włączona. */
  recurringToken:       string | null
  cardMask:             string | null
  cardExpiry:           string | null
  cardIssuer:           string | null
  /** Surowy XML tej transakcji — trafia do rawResponse w bazie. */
  raw:                  Record<string, string>
}

export interface AutopayItn {
  serviceId:    string
  transactions: AutopayItnTransaction[]
}

/** Odczytuje pole `transactions` z POST-a ITN (base64 XML) i weryfikuje hash. */
export function parseItn(encodedTransactions: string): AutopayItn {
  assertConfigured()

  let xml: string
  try {
    xml = Buffer.from(encodedTransactions, 'base64').toString('utf8')
  } catch {
    throw new Error('ITN: pole "transactions" nie jest poprawnym base64.')
  }

  if (!xml.includes('<transactionList')) {
    throw new Error('ITN: zdekodowana treść nie jest komunikatem <transactionList>.')
  }

  const root = parseXml(xml)

  const serviceId = textOf(root, 'serviceID')
  if (serviceId !== SERVICE_ID) {
    throw new Error(`ITN: komunikat dla obcego serwisu (${serviceId}).`)
  }

  const receivedHash = textOf(root, 'hash')
  if (!receivedHash) throw new Error('ITN: brak pola <hash>.')

  const expectedHash = autopayHash(leafValuesInDocumentOrder(root, ['hash']))
  if (!timingSafeEquals(expectedHash, receivedHash)) {
    throw new Error('ITN: nieprawidłowy hash.')
  }

  const container = childNamed(root, 'transactions')
  const nodes = container ? childrenNamed(container, 'transaction') : []
  if (nodes.length === 0) throw new Error('ITN: brak transakcji w komunikacie.')

  return { serviceId, transactions: nodes.map(readTransaction) }
}

function flattenToRecord(element: XmlElement, prefix = ''): Record<string, string> {
  const record: Record<string, string> = {}
  for (const child of element.children) {
    const key = prefix ? `${prefix}.${child.name}` : child.name
    if (child.children.length === 0) {
      record[key] = child.text.trim()
    } else {
      Object.assign(record, flattenToRecord(child, key))
    }
  }
  return record
}

function readTransaction(node: XmlElement): AutopayItnTransaction {
  const autopayOrderId = textOf(node, 'orderID')
  const status = textOf(node, 'paymentStatus').toUpperCase()

  const recurringData = childNamed(node, 'recurringData')
  const cardData      = childNamed(node, 'cardData')

  const recurringToken = recurringData ? textOf(recurringData, 'clientHash') : ''
  const cardMask       = cardData ? textOf(cardData, 'mask')   : ''
  const cardIssuer     = cardData ? textOf(cardData, 'issuer') : ''

  const expiryMonth = cardData ? textOf(cardData, 'validityMonth') : ''
  const expiryYear  = cardData ? textOf(cardData, 'validityYear')  : ''
  const cardExpiry  = expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : ''

  return {
    orderId:              fromAutopayOrderId(autopayOrderId),
    autopayOrderId,
    remoteId:             textOf(node, 'remoteID'),
    amount:               textOf(node, 'amount'),
    currency:             textOf(node, 'currency'),
    gatewayId:            textOf(node, 'gatewayID'),
    paymentDate:          textOf(node, 'paymentDate'),
    paymentStatus:        status === 'SUCCESS' || status === 'FAILURE' ? status : 'PENDING',
    paymentStatusDetails: textOf(node, 'paymentStatusDetails'),
    recurringToken:       recurringToken || null,
    cardMask:             cardMask       || null,
    cardExpiry:           cardExpiry     || null,
    cardIssuer:           cardIssuer     || null,
    raw:                  flattenToRecord(node),
  }
}

/**
 * Odpowiedź na ITN. Autopay ponawia komunikat aż do otrzymania poprawnego
 * potwierdzenia, więc format musi się zgadzać co do znaku.
 */
export function buildItnConfirmation(
  confirmations: Array<{ orderId: string; confirmed: boolean }>,
): string {
  assertConfigured()

  const entries = confirmations.map(({ orderId, confirmed }) => ({
    orderID:      toAutopayOrderId(orderId),
    confirmation: confirmed ? 'CONFIRMED' : 'NOTCONFIRMED',
  }))

  const hash = autopayHash([
    SERVICE_ID,
    ...entries.flatMap(entry => [entry.orderID, entry.confirmation]),
  ])

  const rows = entries
    .map(entry =>
      '    <transactionConfirmed>\n' +
      `      <orderID>${escapeXml(entry.orderID)}</orderID>\n` +
      `      <confirmation>${entry.confirmation}</confirmation>\n` +
      '    </transactionConfirmed>',
    )
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<confirmationList>',
    `  <serviceID>${escapeXml(SERVICE_ID)}</serviceID>`,
    '  <transactionsConfirmations>',
    rows,
    '  </transactionsConfirmations>',
    `  <hash>${hash}</hash>`,
    '</confirmationList>',
  ].join('\n')
}

// ─── zapisane karty: powiadomienia o aktywacji / dezaktywacji ─────────────────

/**
 * Dane zapisanej karty przychodzą OSOBNYM komunikatem, nie w ITN transakcji:
 * POST na ten sam adres ITN z polem `recurring` = base64(XML), korzeń
 * `<recurringActivation>` (karta zapisana po udanej płatności) albo
 * `<recurringDeactivation>` (karta usunięta po stronie Autopay / banku).
 *
 *   <recurringActivation>
 *     <serviceID/>
 *     <transaction><orderID/><remoteID/><amount/>…</transaction>
 *     <recurringData><recurringAction/><clientHash/><expirationDate/></recurringData>
 *     <cardData><index/><validityYear/><validityMonth/><issuer/><bin/><mask/></cardData>
 *     <hash/>
 *   </recurringActivation>
 *
 * Hash jak w ITN: wartości liści w kolejności dokumentu (bez `<hash>`) + klucz.
 * Format zgodny z oficjalną wtyczką Autopay do Magento (`processRecurring`).
 */
export interface AutopayRecurringNotification {
  type:        'activation' | 'deactivation'
  serviceId:   string
  clientHash:  string
  /** UUID zamówienia, którym klient zapisał kartę (tylko aktywacja). */
  orderId:     string | null
  card: {
    /** Stały identyfikator karty w Autopay — ta sama karta = ten sam index. */
    index:         string | null
    mask:          string | null
    issuer:        string | null
    validityMonth: number | null
    validityYear:  number | null
  }
}

export function parseRecurringNotification(encoded: string): AutopayRecurringNotification {
  assertConfigured()

  let xml: string
  try {
    xml = Buffer.from(encoded, 'base64').toString('utf8')
  } catch {
    throw new Error('Recurring: pole "recurring" nie jest poprawnym base64.')
  }

  const root = parseXml(xml)
  const type = root.name === 'recurringActivation'
    ? 'activation'
    : root.name === 'recurringDeactivation'
      ? 'deactivation'
      : null
  if (!type) throw new Error(`Recurring: nieznany komunikat <${root.name}>.`)

  const serviceId = textOf(root, 'serviceID')
  if (serviceId !== SERVICE_ID) {
    throw new Error(`Recurring: komunikat dla obcego serwisu (${serviceId}).`)
  }

  const receivedHash = textOf(root, 'hash')
  if (!receivedHash) throw new Error('Recurring: brak pola <hash>.')
  const expectedHash = autopayHash(leafValuesInDocumentOrder(root, ['hash']))
  if (!timingSafeEquals(expectedHash, receivedHash)) {
    throw new Error('Recurring: nieprawidłowy hash.')
  }

  const recurringData = childNamed(root, 'recurringData')
  const clientHash = recurringData ? textOf(recurringData, 'clientHash') : ''
  if (!clientHash) throw new Error('Recurring: brak <clientHash>.')

  const transaction = childNamed(root, 'transaction')
  const autopayOrderId = transaction ? textOf(transaction, 'orderID') : ''

  const cardData = childNamed(root, 'cardData')
  const read = (name: string) => (cardData ? textOf(cardData, name) : '') || null
  const toInt = (value: string | null) => {
    const number = value ? Number.parseInt(value, 10) : Number.NaN
    return Number.isFinite(number) ? number : null
  }
  const year = toInt(read('validityYear'))

  return {
    type,
    serviceId,
    clientHash,
    orderId: autopayOrderId ? fromAutopayOrderId(autopayOrderId) : null,
    card: {
      index:         read('index'),
      mask:          read('mask'),
      issuer:        read('issuer'),
      validityMonth: toInt(read('validityMonth')),
      validityYear:  year !== null && year < 100 ? 2000 + year : year,
    },
  }
}

/**
 * Odpowiedź na komunikat o karcie. Hash = ALGO(serviceID|clientHash|status|klucz),
 * struktura jak w wtyczce Magento (`recurringResponse`). Bez poprawnej odpowiedzi
 * Autopay ponawia komunikat.
 */
export function buildRecurringConfirmation(clientHash: string, confirmed: boolean): string {
  assertConfigured()
  const status = confirmed ? 'CONFIRMED' : 'NOTCONFIRMED'
  const hash = autopayHash([SERVICE_ID, clientHash, status])

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<confirmationList>',
    `  <serviceID>${escapeXml(SERVICE_ID)}</serviceID>`,
    '  <recurringConfirmations>',
    '    <recurringConfirmed>',
    `      <clientHash>${escapeXml(clientHash)}</clientHash>`,
    `      <confirmation>${status}</confirmation>`,
    '    </recurringConfirmed>',
    '  </recurringConfirmations>',
    `  <hash>${hash}</hash>`,
    '</confirmationList>',
  ].join('\n')
}
