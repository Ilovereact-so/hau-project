import type { AutopayFormPayload } from '@/actions/checkout'

/**
 * Autopay wymaga startu transakcji POST-em (application/x-www-form-urlencoded),
 * więc budujemy ukryty formularz i wysyłamy go z przeglądarki. Wspólne dla
 * kasy i „Zapłać ponownie” na stronie zamówienia.
 */
export function submitAutopayForm({ url, fields }: AutopayFormPayload) {
  const form = document.createElement('form')
  form.method         = 'POST'
  form.action         = url
  form.acceptCharset  = 'UTF-8'
  form.style.display  = 'none'

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type  = 'hidden'
    input.name  = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}
