"use client"

import * as React from "react"
import { Select } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import styles from '../app/index.module.css';

type SizeOption = {
  value?: string
  label?: string
}

type Props = {
  productOptionsSize?: SizeOption[]
  value?: string | null
  onChange?: (value: string | null) => void
}

export default function SizeSelect({
  productOptionsSize = [],
  value,
  onChange,
}: Props) {
  const items = React.useMemo(
    () =>
      productOptionsSize
        .map((size) => {
          const finalValue = size.value?.toUpperCase()
          if (!finalValue) return null

          return {
            label: size.label ?? finalValue,
            value: finalValue,
          }
        })
        .filter(Boolean) as { label: string; value: string }[],
    [productOptionsSize]
  )

  return (
    <Select.Root
      items={items}
      value={value ?? null}
      onValueChange={onChange}
    >
      <Select.Trigger className={styles.Select}>
        <Select.Value className={styles.SelectValue}/>
        <Select.Icon>
          <ChevronDown className={styles.SelectIcon}/>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner side="bottom" className={styles.Positioner} sideOffset={0}>
          <Select.Popup className={styles.Popup}>
            <Select.List className={styles.List}>
              {items.map(({ label, value }) => (
                <Select.Item key={value} value={value} className={styles.Item}>
                  <Select.ItemIndicator className={styles.ItemIndicator}>
                    <Check className={styles.ItemIndicatorIcon}/>
                  </Select.ItemIndicator>
                  <Select.ItemText className={styles.ItemText}>{value}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
