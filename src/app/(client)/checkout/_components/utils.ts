export const STEPS = ['Adres', 'Płatność', 'Finalizacja'] as const
export type Step = 0 | 1 | 2

export function buildVariantLabel(product: any, variantKey: string): string {
  const variant = product.variants?.find((v: any) => v._key === variantKey)
  if (!variant?.optionValues?.length) return ''
  return variant.optionValues
    .map((ov: any) => `${ov.name?.label ?? ''}: ${ov.value?.value ?? ''}`)
    .join(', ')
}
