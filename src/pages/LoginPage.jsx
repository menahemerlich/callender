import { useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { sha256Hex } from '../utils/pinHash'
import { STORAGE_KEYS } from '../utils/storageKeys'

export default function LoginPage({ onLoggedIn }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => {
    const n = name.trim()
    const p = pin.trim()
    return n.length >= 2 && /^\d{4,8}$/.test(p)
  }, [name, pin])

  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-md items-center">
      <section className="glass w-full rounded-3xl p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="text-right">
            <h2 className="text-xl font-semibold tracking-tight">התחברות</h2>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              שם + קוד (ספרות)
            </div>
          </div>
          <div className="glass rounded-2xl px-3 py-2 text-xs text-[color:var(--muted)]">
            Expense-Control
          </div>
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!canSubmit) return
            if (!supabase) {
              setError('אין חיבור ל-DB (Supabase לא מוגדר).')
              return
            }
            setLoading(true)
            setError('')
            try {
              const n = name.trim()
              const hash = await sha256Hex(pin.trim())

              const res = await supabase
                .from('allowed_users')
                .select('name,pin_hash')
                .eq('name', n)
                .maybeSingle()

              if (res.error) throw res.error
              if (!res.data) {
                setError('שם או קוד לא נכונים.')
                return
              }
              if ((res.data.pin_hash || '').toLowerCase() !== hash.toLowerCase()) {
                setError('שם או קוד לא נכונים.')
                return
              }

              const session = { name: n, loggedInAt: new Date().toISOString() }
              localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
              onLoggedIn?.(session)
            } catch (err) {
              setError(err?.message || 'שגיאה בהתחברות')
            } finally {
              setLoading(false)
            }
          }}
        >
          <label className="text-xs text-[color:var(--muted)]">
            שם
            <input
              className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError('')
              }}
              autoComplete="username"
              placeholder="לדוגמה: אבי"
              required
            />
          </label>

          <label className="text-xs text-[color:var(--muted)]">
            קוד (4–8 ספרות)
            <div className="relative mt-1">
              <input
                className="input w-full rounded-xl px-3 py-2 pe-11 text-sm outline-none"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^\d]/g, ''))
                  if (error) setError('')
                }}
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="••••"
                required
              />
              <button
                type="button"
                className="btn absolute inset-y-1 left-1 inline-flex items-center justify-center rounded-xl px-3 text-sm"
                onClick={() => setShowPin((v) => !v)}
                title={showPin ? 'הסתר קוד' : 'הצג קוד'}
              >
                {showPin ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {error ? (
            <div
              className="rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.10)',
              }}
            >
              <div className="font-semibold">לא הצליח להתחבר</div>
              <div className="mt-1 text-[color:var(--muted)]">{error}</div>
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btnPrimary mt-2 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={!canSubmit || loading}
          >
            {loading ? 'מתחבר…' : 'כניסה'}
          </button>

          <div className="pt-1 text-xs text-[color:var(--muted)]">
            אם אין לך הרשאה, פנה למנהל המערכת כדי להוסיף אותך ל־DB.
          </div>
        </form>
      </section>
    </main>
  )
}

