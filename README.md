# Expense-Control (callender)

## Login (שם + קוד ספרותי)

האפליקציה כוללת דף התחברות ב־`/login` שמחסום את כל שאר הדפים עד התחברות.

### 1) יצירת טבלת משתמשים מורשים ב‑Supabase

ב־Supabase SQL Editor הרץ את הקובץ:

- `supabase_allowed_users.sql`

### 2) הוספת משתמש מורשה

צריך להוסיף רשומה לטבלה `allowed_users` עם:
- **name**: שם המשתמש (כפי שיקליד בדף התחברות)\n+- **pin_hash**: SHA-256 hex של ה‑PIN (ספרות)

דוגמה (החלף את הערכים):

```sql
insert into public.allowed_users (id, name, pin_hash)
values ('user_jbh', 'JBH', '<sha256-hex-of-pin>')
on conflict (name) do update set pin_hash = excluded.pin_hash;
```

### 3) איך מייצרים `pin_hash`

ה‑`pin_hash` הוא SHA‑256 (hex) של ה‑PIN. אפשר לייצר אותו בכל כלי SHA‑256, או זמנית עם DevTools בדפדפן:

```js
// בדפדפן:
await (async () => {
  const enc = new TextEncoder().encode('1234')
  const buf = await crypto.subtle.digest('SHA-256', enc)
  const bytes = Array.from(new Uint8Array(buf))
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
})()
```

## Supabase connection

- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`\n+- אם env לא נטען, אפשר להגדיר URL+Key דרך הפאנל באפליקציה (נשמר ב‑localStorage).
