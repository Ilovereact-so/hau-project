import { SearchX } from 'lucide-react'
import { ButtonLink } from '@/components/admin/kit/Button'
import { EmptyState } from '@/components/admin/kit/EmptyState'

export default function AdminNotFound() {
  return (
    <EmptyState icon={<SearchX size={20} strokeWidth={1.5} />} title="Nie znaleziono" className="animate-fade-in">
      Tego elementu nie ma — mógł zostać usunięty albo adres jest niepełny.
      <span className="mt-4 flex justify-center">
        <ButtonLink href="/admin" size="sm" variant="secondary">
          Wróć do dashboardu
        </ButtonLink>
      </span>
    </EmptyState>
  )
}
