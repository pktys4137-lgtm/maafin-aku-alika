# Untuk kamu — situs permintaan maaf (khusus Vercel)

Halaman statis + satu serverless function + Postgres.

```
public/            -> file statis (halaman utama, CSS, JS, aset admin)
admin/*.html       -> halaman admin, hanya disajikan lewat /api setelah cek login
api/index.js       -> semua endpoint (respons, login, statistik)
vercel.json        -> rewrite /admin, header keamanan, includeFiles
```

## Deploy ke Vercel

1. Push folder ini ke GitHub, lalu **Import** ke Vercel. Framework Preset: **Other**. Jangan isi Build Command atau Output Directory.
2. Buka tab **Storage**, buat database **Postgres (Neon)**, lalu hubungkan ke project. Variabel `POSTGRES_URL` terisi otomatis.
3. Isi **Environment Variables** (Settings > Environment Variables):

| Nama | Isi |
| --- | --- |
| `ADMIN_USERNAME` | username admin |
| `ADMIN_PASSWORD_HASH` | hash bcrypt (lihat di bawah) |
| `SESSION_SECRET` | string acak panjang, minimal 32 karakter |
| `NODE_ENV` | `production` |

4. **Redeploy** supaya variabel terbaca.
5. Buka `/` untuk halaman utama dan `/admin` untuk login.

Tabel `responses` dibuat otomatis saat jawaban pertama masuk.

## Membuat hash password

```bash
npm install bcryptjs
node -e "require('bcryptjs').hash('PASSWORD_BARU', 12).then(console.log)"
```

Salin seluruh hasilnya (`$2b$12$...`) ke `ADMIN_PASSWORD_HASH`. Di dashboard Vercel, tanda `$` boleh ditempel apa adanya.

Secret bisa dibuat dengan:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Jalankan lokal

```bash
npm install
cp .env.example .env   # lalu isi nilainya
npx vercel link && npx vercel env pull .env
npx vercel dev
```

## Catatan

- Satu perangkat hanya bisa mengirim satu jawaban (cookie bertanda tangan).
- Cookie admin dan cookie jawaban terpisah, jadi login admin tidak menimpa status jawaban.
- Situs ditandai `noindex`, jadi tidak muncul di Google.
- Ganti password apa pun yang pernah dibagikan lewat chat atau masuk ke git.
