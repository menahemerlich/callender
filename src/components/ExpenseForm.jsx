import { useMemo, useState } from 'react'
import CategoryInlineAdd from './CategoryInlineAdd'
import CategoryPicker from './CategoryPicker'
import { normalizeStoreKey, normalizeStoreName } from '../utils/storeMemory'

export default function ExpenseForm({
  categories,
  onAddExpense,
  onAddCategory,
  storeMemory,
  expenses,
  defaultUpdaterName = '',
}) {
  const todayYmd = new Date().toISOString().slice(0, 10)
  const [updaterName, setUpdaterName] = useState(defaultUpdaterName || '')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories?.[0]?.id || '')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [product, setProduct] = useState('')
  const [store, setStore] = useState('')
  const [storeSuggestOpen, setStoreSuggestOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [createdAt, setCreatedAt] = useState(todayYmd)
  const [addingCategory, setAddingCategory] = useState(false)

  const storesFromHistory = useMemo(() => {
    const set = new Set()
    for (const e of expenses || []) {
      const name = normalizeStoreName(e.store)
      const key = normalizeStoreKey(name)
      if (!key) continue
      // keep a "pretty" display value (first seen wins)
      if (!set.has(key)) set.add(key)
    }
    return [...set]
  }, [expenses])

  const lastCategoryByStore = useMemo(() => {
    const map = new Map()
    for (const e of expenses || []) {
      const key = normalizeStoreKey(e.store)
      if (!key) continue
      // since our expenses are newest-first, first match is "last used"
      if (!map.has(key)) map.set(key, e.categoryId)
    }
    return map
  }, [expenses])

  const storeSuggestions = useMemo(() => {
    const q = normalizeStoreKey(store)
    if (!q || q.length < 2) return []
    const keys = Array.from(
      new Set([...(Object.keys(storeMemory || {}) || []), ...storesFromHistory]),
    )
    return keys.filter((k) => k.includes(q)).slice(0, 6)
  }, [store, storeMemory, storesFromHistory])

  function applyStoreMemoryIfNeeded(nextStoreValue) {
    if (categoryTouched) return
    const key = normalizeStoreKey(nextStoreValue)
    if (!key) return
    const catId = storeMemory?.[key] || lastCategoryByStore.get(key)
    if (!catId) return
    setCategoryId(catId)
    setCategoryTouched(false)
  }

  const canSubmit = useMemo(() => {
    return (
      updaterName.trim().length >= 2 &&
      product.trim().length >= 1 &&
      store.trim().length >= 1 &&
      Number(amount) > 0 &&
      !!categoryId &&
      (paymentMethod === 'cash' ||
        paymentMethod === 'credit' ||
        paymentMethod === 'other') &&
      /^\d{4}-\d{2}-\d{2}$/.test(createdAt)
    )
  }, [amount, categoryId, createdAt, paymentMethod, product, store, updaterName])
  const formatCurrency = (value) => {
    if (!value) return '';

    const [intPart, decPart] = value.split('.');

    const formattedInt = Number(intPart || 0).toLocaleString('en-US');

    return decPart !== undefined
      ? `${formattedInt}.${decPart}`
      : formattedInt;
  };

  const handleChange = (e) => {
    let value = e.target.value;

    // ניקוי תווים לא חוקיים
    value = value.replace(/[^\d.]/g, '');

    // רק נקודה אחת
    value = value.replace(/(\..*)\./g, '$1');

    // נקודה בהתחלה → 0.
    if (value.startsWith('.')) {
      value = '0' + value;
    }

    // הגבלה ל־2 ספרות אחרי נקודה
    if (value.includes('.')) {
      const [intPart, decPart] = value.split('.');
      value = intPart + '.' + decPart.slice(0, 2);
    }

    setAmount(value);
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onAddExpense({
          updaterName: updaterName.trim(),
          amount,
          categoryId,
          product: product.trim(),
          store: store.trim(),
          paymentMethod,
          createdAt,
        })
        setUpdaterName('')
        setAmount('')
        setProduct('')
        setStore('')
        setCategoryTouched(false)
        setCreatedAt(todayYmd)
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-[color:var(--muted)]">
          שם מעדכן
          <input
            className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
            value={updaterName}
            onChange={(e) => setUpdaterName(e.target.value)}
            placeholder="לדוגמה: יוסי"
            autoComplete="name"
            required
          />
        </label>
        <label className="text-xs text-[color:var(--muted)]">
          סכום
          <input
            className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
            value={amount ? `₪ ${formatCurrency(amount)}` : ''}
            onChange={handleChange}
            placeholder="₪"
            inputMode="decimal"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-[color:var(--muted)]">
          מוצר/שירות
          <input
            className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="לדוגמה: קפה"
            required
          />
        </label>
        <label className="text-xs text-[color:var(--muted)]">
          חנות/ספק
          <div className="relative">
            <input
              className="input mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
              value={store}
              onChange={(e) => {
                const next = e.target.value
                setStore(next)
                setStoreSuggestOpen(true)
                // auto-fill category on exact match (no need to select suggestion)
                applyStoreMemoryIfNeeded(next)
              }}
              onFocus={() => setStoreSuggestOpen(true)}
              onBlur={() => {
                // allow suggestion click before closing
                window.setTimeout(() => setStoreSuggestOpen(false), 120)
                applyStoreMemoryIfNeeded(store)
              }}
              placeholder="לדוגמה: פז"
              required
            />

            {storeSuggestOpen && storeSuggestions.length ? (
              <div className="absolute z-10 mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-2 shadow-[var(--shadow)]">
                <div className="text-xs text-[color:var(--muted)]">
                  הצעות (בבחירה תמולא גם הקטגוריה)
                </div>
                <div className="mt-1 space-y-1">
                  {storeSuggestions.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="btn w-full rounded-xl px-3 py-2 text-right text-sm hover:bg-[color:var(--card2)]"
                      onMouseDown={(e) => {
                        // select before the input loses focus (prevents blur-close race)
                        e.preventDefault()
                        const storeName = normalizeStoreName(k)
                        setStore(storeName)
                        const catId = storeMemory?.[k] || lastCategoryByStore.get(k)
                        if (catId) {
                          setCategoryId(catId)
                          setCategoryTouched(false)
                        }
                        setStoreSuggestOpen(false)
                      }}
                    >
                      {normalizeStoreName(k)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
        <label className="text-xs text-[color:var(--muted)] sm:col-span-1">
          תאריך
          <input
            className="input mt-1 h-[42px] w-full rounded-xl px-3 py-2 text-sm outline-none"
            type="date"
            value={createdAt}
            onChange={(e) => setCreatedAt(e.target.value)}
            required
          />
        </label>
        <fieldset className="text-xs text-[color:var(--muted)] sm:col-span-2">
          <legend className="text-xs text-[color:var(--muted)]">איך שולם</legend>
          <div className="mt-1 flex w-full items-center gap-2 overflow-hidden">
            <label className="btn inline-flex h-[42px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs">
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              />
              <span aria-hidden="true">💵</span>
              מזומן
            </label>
            <label className="btn inline-flex h-[42px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs">
              <input
                type="radio"
                name="paymentMethod"
                value="credit"
                checked={paymentMethod === 'credit'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              />
              <span aria-hidden="true">💳</span>
              אשראי
            </label>
            <label className="btn inline-flex h-[42px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs">
              <input
                type="radio"
                name="paymentMethod"
                value="other"
                checked={paymentMethod === 'other'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              />
              <span aria-hidden="true">🧾</span>
              אחר
            </label>
          </div>
        </fieldset>
      </div>

      <div>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs text-[color:var(--muted)]">
            קטגוריה
            <CategoryPicker
              categories={categories}
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id)
                setCategoryTouched(true)
              }}
              required
            />
          </label>
          <button
            type="button"
            className="btn rounded-xl px-3 py-2 text-sm"
            onClick={() => setAddingCategory((v) => !v)}
          >
            +
          </button>
        </div>
        {addingCategory ? (
          <div className="mt-2">
            <CategoryInlineAdd
              onClose={() => setAddingCategory(false)}
              onAdd={(cat) => {
                const created = onAddCategory(cat)
                setCategoryId(created.id)
                setCategoryTouched(true)
                setAddingCategory(false)
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="pt-1">
        <button
          type="submit"
          className="btn btnPrimary w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          disabled={!canSubmit}
        >
          הוסף הוצאה
        </button>
      </div>
    </form>
  )
}

