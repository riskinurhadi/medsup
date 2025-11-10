# 📱 Media Sosial Agent

Website agent untuk mengupload konten ke TikTok, Instagram, dan Facebook secara bersamaan dengan satu kali klik.

## ✨ Fitur

- ✅ Upload konten ke 3 platform sekaligus (TikTok, Instagram, Facebook)
- ✅ Support gambar dan video
- ✅ Interface yang user-friendly
- ✅ Real-time progress tracking
- ✅ OAuth authentication untuk semua platform
- ✅ Preview file sebelum upload

## 🚀 Instalasi

### 1. Clone atau download project ini

### 2. Install dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Copy file `.env.example` menjadi `.env` dan isi dengan kredensial API Anda:

```bash
cp .env.example .env
```

Edit file `.env` dan isi dengan:
- Facebook App ID & Secret
- Instagram App ID & Secret  
- TikTok Client Key & Secret

### 4. Setup API Credentials

#### Facebook & Instagram:
1. Buka [Facebook Developers](https://developers.facebook.com/)
2. Buat aplikasi baru
3. Tambahkan produk "Facebook Login" dan "Instagram Basic Display"
4. Set redirect URI: `http://localhost:3000/api/auth/facebook/callback`
5. Dapatkan App ID dan App Secret

#### TikTok:
1. Buka [TikTok Developers](https://developers.tiktok.com/)
2. Buat aplikasi baru
3. Set redirect URI: `http://localhost:3000/api/auth/tiktok/callback`
4. Dapatkan Client Key dan Client Secret

### 5. Jalankan Server

```bash
npm start
```

Atau untuk development dengan auto-reload:

```bash
npm run dev
```

### 6. Buka Browser

Buka `http://localhost:3000` di browser Anda.

## 📖 Cara Menggunakan

1. **Koneksi Akun Media Sosial**
   - Klik tombol "Koneksi Facebook/Instagram/TikTok"
   - Login dan berikan izin akses
   - Window akan tertutup otomatis setelah berhasil

2. **Upload Konten**
   - Pilih file gambar atau video
   - Tulis caption untuk postingan
   - Pilih platform yang ingin digunakan (bisa pilih beberapa sekaligus)
   - Klik "Upload ke Semua Platform"

3. **Lihat Hasil**
   - Progress upload akan ditampilkan secara real-time
   - Setelah selesai, hasil upload akan ditampilkan dengan link ke postingan

## 📁 Struktur Project

```
medsup/
├── index.html          # Frontend interface
├── styles.css         # Styling
├── app.js             # Frontend JavaScript
├── server.js          # Backend server
├── handlers/          # Platform handlers
│   ├── facebook.js
│   ├── instagram.js
│   └── tiktok.js
├── package.json       # Dependencies
├── .env.example       # Environment variables template
└── README.md          # Dokumentasi
```

## ⚠️ Catatan Penting

1. **Facebook & Instagram**: 
   - Perlu Facebook Page untuk posting ke Facebook
   - Perlu Instagram Business Account untuk posting ke Instagram
   - Token perlu di-refresh secara berkala

2. **TikTok**:
   - Hanya mendukung upload video
   - Perlu approval dari TikTok untuk production use
   - Video harus memenuhi [TikTok Community Guidelines](https://www.tiktok.com/community-guidelines)

3. **File Upload**:
   - Maksimal ukuran file: 100MB
   - Format yang didukung: JPEG, PNG, GIF, MP4, MOV, AVI
   - Untuk Instagram, file perlu di-upload ke URL yang publicly accessible (gunakan cloud storage di production)

## 🔒 Keamanan

- Jangan commit file `.env` ke repository
- Simpan token dengan aman
- Gunakan HTTPS di production
- Validasi semua input dari user

## 🛠️ Troubleshooting

### Error: "Platform tidak terhubung"
- Pastikan sudah klik tombol koneksi dan login berhasil
- Cek apakah token masih valid di file `.facebook_token`, `.instagram_token`, atau `.tiktok_token`

### Error: "Gagal upload"
- Cek ukuran file (maks 100MB)
- Pastikan format file didukung
- Cek koneksi internet
- Lihat log di console server untuk detail error

### Instagram upload gagal
- Pastikan menggunakan Instagram Business Account
- File perlu di-upload ke URL yang publicly accessible
- Untuk development, gunakan ngrok atau service serupa

## 📝 License

MIT License

## 🤝 Kontribusi

Silakan buat issue atau pull request jika ingin berkontribusi!

---

**Selamat menggunakan Media Sosial Agent! 🎉**

