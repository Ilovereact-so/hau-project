"use client"

import * as React from "react"
import { Select } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import styles from '../app/index.module.css';
import { GetSlugProduct, Slug } from "../../sanity.types";
import { VariantOption } from "./OptionWidthImageFromVariant";


type Props = {
  filterValues?: GetSlugProduct["filterValues"];
  option: VariantOption;
  setValue?: (value: string) => void
}

export default function SizeSelect({
  option,
  filterValues,
  setValue,
}: Props) {
  const items = React.useMemo(
    () =>
      filterValues
        ?.map((item) => {
          return {
            label: item.value,
            value: item.slug?.current,
          }
        })
        .filter(Boolean) as { label: string; value: string }[],
    [filterValues]
  )

  const handleValueChange = React.useCallback((value: string | null) => {
    setValue?.(value as string)
  }, [setValue])

  return (
    <Select.Root
      items={items}
      value={option?.value?.slug?.current ?? null}
      onValueChange={handleValueChange}
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
                  <Select.ItemText className={styles.ItemText}>{label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
