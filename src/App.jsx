import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { useSupabaseData } from './hooks/useSupabaseData'
import { useToasts } from './hooks/useToasts'
import { STORAGE_KEYS } from './utils/storageKeys'
import Dashboard from './components/Dashboard'
import ExpenseForm from './components/ExpenseForm'
import ExpenseFilters from './components/ExpenseFilters'
import ExpenseList from './components/ExpenseList'
import ThemeToggle from './components/ThemeToggle'
import ConfirmModal from './components/ConfirmModal'
import Toasts from './components/Toasts'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import StatsPage from './pages/StatsPage'
import CyclesPage from './pages/CyclesPage'
import { sortExpenses } from './utils/sorting'
import { normalizeStoreKey, normalizeStoreName } from './utils/storeMemory'
import { monthlyWindow11To10, toMs } from './utils/dateRanges'
import { SUPABASE_STORAGE_KEYS } from './utils/supabaseClient'

function App() {
  const [theme, setTheme] = useLocalStorageState(STORAGE_KEYS.theme, 'dark')
  const {
    ready: dbReady,
    error: dbError,
    connected: dbConnected,
    outboxCount,
    categories,
    expenses,
    budgets,
    storeMemory,
    includeOtherInTotals,
    addCategory,
    addExpense,
    updateExpense,
    deleteExpense,
    setBudgets,
    setStoreMemory,
    setIncludeOtherInTotals,
    refresh,
    flushOutbox,
  } = useSupabaseData()

  const [query, setQuery] = useState('')
  const [categoryFilterId, setCategoryFilterId] = useState('all')
  const [sortId, setSortId] = useState('date_desc')
  const [showExpenses, setShowExpenses] = useState(false)
  const [homeAllHistory, setHomeAllHistory] = useState(false)

  const { toasts, pushToast, removeToast } = useToasts()

  const filteredExpenses = useMemo(() => {
    const q = query.trim().toLowerCase()
    const window = monthlyWindow11To10()
    const startMs = window.start.getTime()
    const endMs = window.end.getTime()
    const base = expenses.filter((e) => {
      if (!homeAllHistory) {
        const t = toMs(e.createdAt)
        if (t < startMs || t > endMs) return false
      }
      const matchesCategory =
        categoryFilterId === 'all' || e.categoryId === categoryFilterId
      if (!matchesCategory) return false
      if (!q) return true
      const haystack = `${e.store} ${e.product} ${e.updaterName}`.toLowerCase()
      return haystack.includes(q)
    })
    return sortExpenses(base, sortId)
  }, [categoryFilterId, expenses, homeAllHistory, query, sortId])

  const filteredTotal = useMemo(
    () =>
      filteredExpenses.reduce((sum, e) => {
        if (!includeOtherInTotals && e?.paymentMethod === 'other') return sum
        return sum + (Number(e.amount) || 0)
      }, 0),
    [filteredExpenses, includeOtherInTotals],
  )

  const [confirmState, setConfirmState] = useState(null)

  async function handleAddCategory(partial) {
    try {
      const id =
        partial?.id || `cat_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const next = { id, ...partial }
      await addCategory(next)
      pushToast({ type: 'success', title: 'קטגוריה נוספה' })
      return next
    } catch (e) {
      pushToast({
        type: 'error',
        title: 'שגיאה בשמירת קטגוריה ל-DB',
        message: e?.message || 'נסה שוב',
      })
      console.error('Supabase addCategory error', e)
      throw e
    }
  }

  async function handleAddExpense(payload) {
    try {
      const storeName = normalizeStoreName(payload.store)
      const storeKey = normalizeStoreKey(storeName)

      const next = {
        id: `exp_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        createdAt: payload.createdAt || new Date().toISOString().slice(0, 10),
        ...payload,
        amount: Number(payload.amount),
        paymentMethod: payload.paymentMethod || 'cash',
        store: storeName,
      }
      await addExpense(next)
      if (storeKey && payload.categoryId) {
        await setStoreMemory((prev) => ({
          ...(prev || {}),
          [storeKey]: payload.categoryId,
        }))
      }
      pushToast({ type: 'success', title: 'הוצאה נוספה' })
    } catch (e) {
      pushToast({
        type: 'error',
        title: 'שגיאה בשמירת הוצאה ל-DB',
        message: e?.message || 'נסה שוב',
      })
      console.error('Supabase addExpense error', e)
      throw e
    }
  }

  async function handleUpdateExpense(id, updates) {
    try {
      await updateExpense(id, updates)
      pushToast({ type: 'info', title: 'הוצאה עודכנה' })
    } catch (e) {
      pushToast({
        type: 'error',
        title: 'שגיאה בעדכון הוצאה ב-DB',
        message: e?.message || 'נסה שוב',
      })
      console.error('Supabase updateExpense error', e)
      throw e
    }
  }

  function requestDeleteExpense(expense) {
    setConfirmState({
      title: 'מחיקת הוצאה',
      description: `למחוק את "${expense.product}" מ-"${expense.store}"?`,
      confirmText: 'כן, למחוק',
      danger: true,
      onConfirm: () => {
        deleteExpense(expense.id)
          .then(() => pushToast({ type: 'success', title: 'הוצאה נמחקה' }))
          .catch((e) =>
            pushToast({
              type: 'error',
              title: 'שגיאה במחיקת הוצאה מה-DB',
              message: e?.message || 'נסה שוב',
            }),
          )
      },
    })
  }

  function handleSetTheme(next) {
    setTheme(next)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const home = (
    <main className="mx-auto mt-6 grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <section className="glass rounded-2xl p-4 sm:p-6 lg:col-span-5">
        <h2 className="text-lg font-semibold">הוספת הוצאה</h2>
        <div className="mt-4">
          <ExpenseForm
            categories={categories}
            onAddExpense={handleAddExpense}
            onAddCategory={handleAddCategory}
            storeMemory={storeMemory}
            expenses={expenses}
          />
        </div>
      </section>

      <section className="glass rounded-2xl p-4 sm:p-6 lg:col-span-7">
        <Dashboard
          expenses={expenses}
          budgets={budgets}
          includeOtherInTotals={includeOtherInTotals}
        />
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="btn btnPrimary w-full rounded-2xl px-4 py-2.5 text-sm font-semibold"
              onClick={() => setShowExpenses((v) => !v)}
            >
              {showExpenses ? 'הסתר הוצאות' : 'הצג הוצאות'}
            </button>
            <button
              type="button"
              className={`btn w-full rounded-2xl px-4 py-2.5 text-sm font-semibold ${
                homeAllHistory ? '' : 'btnPrimary'
              }`}
              onClick={() => setHomeAllHistory((v) => !v)}
              title="ברירת מחדל: מחזור נוכחי (11→10)"
            >
              {homeAllHistory ? 'כל ההיסטוריה' : 'רק מחזור נוכחי (11→10)'}
            </button>
          </div>
        </div>

        {showExpenses ? (
          <div className="mt-4 space-y-4">
            <ExpenseFilters
              categories={categories}
              query={query}
              onQueryChange={setQuery}
              categoryFilterId={categoryFilterId}
              onCategoryFilterIdChange={setCategoryFilterId}
              sortId={sortId}
              onSortIdChange={setSortId}
              filteredTotal={filteredTotal}
            />
            <ExpenseList
              expenses={filteredExpenses}
              categories={categories}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={requestDeleteExpense}
            />
          </div>
        ) : null}
      </section>
    </main>
  )

  return (
    <BrowserRouter basename="/callender">
      <div className="min-h-[100svh] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight">
              Expense-Control
            </div>
            <div className="text-sm text-[color:var(--muted)]">
             ניהול הוצאות יומי בדיקה!!!
            </div>
            <nav className="mt-2 flex flex-wrap gap-2 text-sm">
              <Link className="btn rounded-xl px-3 py-2" to="/">
                בית
              </Link>
              <Link className="btn rounded-xl px-3 py-2" to="/stats">
                סטטיסטיקות
              </Link>
              <Link className="btn rounded-xl px-3 py-2" to="/cycles">
                מחזורים
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="glass rounded-xl px-3 py-2 text-sm"
              title={
                dbConnected
                  ? 'מחובר ל-DB'
                  : outboxCount
                    ? `לא מחובר ל-DB • ממתין לסנכרון: ${outboxCount}`
                    : 'לא מחובר ל-DB'
              }
              style={{
                border: '1px solid var(--border)',
                background: dbConnected
                  ? 'rgba(34, 197, 94, 0.14)'
                  : 'rgba(239, 68, 68, 0.12)',
              }}
            >
              {dbConnected ? 'DB: מחובר' : `DB: אופליין${outboxCount ? ` (${outboxCount})` : ''}`}
            </div>
            <button
              type="button"
              className="btn rounded-xl px-3 py-2 text-sm"
              onClick={() => refresh()}
              title="טעינה מחדש מה-DB"
            >
              רענן
            </button>
            {outboxCount ? (
              <button
                type="button"
                className="btn rounded-xl px-3 py-2 text-sm"
                onClick={() => flushOutbox()}
                title="נסיון סנכרון שינויים שנשמרו אופליין"
              >
                סנכרן
              </button>
            ) : null}
            <button
              type="button"
              className={`btn rounded-xl px-3 py-2 text-sm ${
                includeOtherInTotals ? 'btnPrimary' : ''
              }`}
              onClick={() => setIncludeOtherInTotals((v) => !v)}
              title="ברירת מחדל: לא כולל הוצאות 'אחר' בחישובי סכומים"
            >
              {includeOtherInTotals ? "סכומים: כולל 'אחר'" : "סכומים: בלי 'אחר'"}
            </button>
            <ThemeToggle value={theme} onChange={handleSetTheme} />
          </div>
        </header>

        {!dbReady ? (
          <div className="mx-auto mt-4 w-full max-w-6xl text-sm text-[color:var(--muted)]">
            טוען נתונים...
          </div>
        ) : dbError ? (
          <div className="mx-auto mt-4 w-full max-w-6xl rounded-2xl border border-[color:var(--border)] bg-white/5 p-4 text-sm">
            <div className="font-semibold">בעיה בחיבור ל-DB</div>
            <div className="mt-1 text-[color:var(--muted)]">{dbError}</div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs text-[color:var(--muted)]">
                Supabase URL
                <input
                  className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  defaultValue={localStorage.getItem(SUPABASE_STORAGE_KEYS.url) || ''}
                  placeholder="https://xxxx.supabase.co"
                  onBlur={(e) =>
                    localStorage.setItem(SUPABASE_STORAGE_KEYS.url, e.target.value.trim())
                  }
                />
              </label>
              <label className="text-xs text-[color:var(--muted)]">
                Supabase anon key
                <input
                  className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  defaultValue={localStorage.getItem(SUPABASE_STORAGE_KEYS.anonKey) || ''}
                  placeholder="eyJ..."
                  onBlur={(e) =>
                    localStorage.setItem(
                      SUPABASE_STORAGE_KEYS.anonKey,
                      e.target.value.trim(),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="btn btnPrimary rounded-xl px-4 py-2 text-sm font-semibold sm:col-span-2"
                onClick={() => window.location.reload()}
              >
                שמור וטען מחדש
              </button>
            </div>
          </div>
        ) : null}

        <Routes>
          <Route path="/" element={home} />
          <Route
            path="/stats"
            element={
              <StatsPage
                expenses={expenses}
                categories={categories}
                budgets={budgets}
                onBudgetsChange={setBudgets}
                includeOtherInTotals={includeOtherInTotals}
                onIncludeOtherInTotalsChange={setIncludeOtherInTotals}
              />
            }
          />
          <Route
            path="/cycles"
            element={
              <CyclesPage
                expenses={expenses}
                categories={categories}
                includeOtherInTotals={includeOtherInTotals}
              />
            }
          />
          <Route
            path="/cycles/:startYmd"
            element={
              <CyclesPage
                expenses={expenses}
                categories={categories}
                includeOtherInTotals={includeOtherInTotals}
              />
            }
          />
        </Routes>

        <Toasts toasts={toasts} onDismiss={removeToast} />

        <ConfirmModal
          open={!!confirmState}
          title={confirmState?.title}
          description={confirmState?.description}
          confirmText={confirmState?.confirmText}
          danger={confirmState?.danger}
          onClose={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState?.onConfirm
            setConfirmState(null)
            action?.()
          }}
        />
      </div>
    </BrowserRouter>
  )
}

export default App
