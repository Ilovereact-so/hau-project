'use client'

import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { Mail, RotateCcw, Save } from 'lucide-react'
import { updateNewsletterWelcomeTemplate } from '@/actions/newsletterSettings'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { ErrorBox } from '../kit/EmptyState'
import { TextAreaField, TextField } from '../kit/TextField'
import { cn } from '../kit/utils'

/**
 * Szablon maila powitalnego newslettera: edycja + podgląd na żywo.
 * Podgląd siedzi w `<iframe sandbox>` — HTML maila nie może uruchomić
 * skryptów ani odziedziczyć stylów panelu.
 */
export function NewsletterTemplateEditor({
  initial,
  defaults,
}: {
  initial: { subject: string; html: string }
  defaults: { subject: string; html: string }
}) {
  const [subject, setSubject] = useState(initial.subject)
  const [html, setHtml] = useState(initial.html)
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [previewEmail, setPreviewEmail] = useState('klient@example.com')
  const dirty = subject !== saved.subject || html !== saved.html

  const save = () =>
    startTransition(async () => {
      setError('')
      const result = await updateNewsletterWelcomeTemplate({ subject, html })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved({ subject: subject.trim(), html: html.trim() })
      toast.success('Szablon maila zapisany')
    })

  const preview = html.replaceAll('{{email}}', previewEmail)

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Mail}
        title="Mail powitalny newslettera"
        subtitle={
          <>
            Wysyłany po zapisie do newslettera. Placeholder <code className="font-mono">{'{{email}}'}</code> zostanie zastąpiony adresem subskrybenta.
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (!window.confirm('Wczytać domyślny szablon? Niezapisane zmiany przepadną.')) return
                setSubject(defaults.subject)
                setHtml(defaults.html)
              }}
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              Domyślny
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !dirty}>
              <Save size={14} strokeWidth={1.5} />
              {pending ? 'Zapisywanie…' : dirty ? 'Zapisz szablon' : 'Zapisano'}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 px-4 pt-3 pb-4 xl:grid-cols-2">
        <div className="flex flex-col gap-3">
          <TextField label="Temat" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={256} />
          <TextAreaField
            label="Treść HTML"
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            rows={20}
            spellCheck={false}
            className="font-mono text-xs leading-[1.5]"
            hint={`${html.length.toLocaleString('pl-PL')} / 100 000 znaków`}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-2">Podgląd</span>
            <input
              value={previewEmail}
              onChange={(event) => setPreviewEmail(event.target.value)}
              aria-label="Adres w podglądzie"
              className="h-7 w-48 rounded-xs border border-border bg-surface px-2 text-[11px] text-text outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div className="rounded-xs border border-border bg-surface px-3 py-2 text-xs">
            <span className="text-text-2">Temat: </span>
            <b className="font-medium text-text">{subject.replaceAll('{{email}}', previewEmail) || '—'}</b>
          </div>
          <iframe
            title="Podgląd maila"
            sandbox=""
            srcDoc={preview}
            className={cn('h-[520px] w-full rounded-xs border border-border bg-white')}
          />
        </div>
      </div>
    </Card>
  )
}
