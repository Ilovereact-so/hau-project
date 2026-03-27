import { useEffect, useRef, useState } from "react"
import { ProductSearchResult, searchProductsByName } from "@/sanity/helpers/clientRequest"


export function useProductSearch(query: string) {
  const [results, setResults] = useState<Array<ProductSearchResult & {path: string}>>([])
  const [loading, setLoading] = useState(false)

  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        // anuluj poprzedni request
        controllerRef.current?.abort()

        const controller = new AbortController()
        controllerRef.current = controller

        setLoading(true)

        const data = await searchProductsByName(query, controller)
        console.log("search results", data)

        const finaldata = data.map((d:ProductSearchResult) => ({
          ...d,
          path: `${d.category.title} > ${d.type.title}`
        }))
        setResults(finaldata)
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error(err)
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading }
}