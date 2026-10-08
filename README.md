# 🎨 Draw App - Digital Drawing & Animation Web App

**Draw App** adalah aplikasi menggambar digital dan animasi 2D berbasis peramban (browser) yang sangat interaktif dan responsif. Proyek ini dikembangkan dengan React, TypeScript, dan HTML5 Canvas 2D Engine, serta dilengkapi dengan integrasi **AI Chatbot (Google Gemini)** sebagai asisten interaktif bagi pemula.

Proyek ini dibangun khusus untuk kebutuhan Tugas Akhir / Skripsi yang berfokus pada performa grafis, antarmuka pengguna (UI/UX) yang modern, dan integrasi Artificial Intelligence dalam web-based drawing tool.

---

## ✨ Fitur Unggulan

### 🖍️ Drawing Engine Tingkat Lanjut
* **Brush System:** Mendukung tekanan (*pressure sensitivity*) dan penstabil goresan (*stroke stabilizer*).
* **Macam-macam Alat:** Brush, Eraser, Line, Ellipse, Rectangle, Text, Eyedropper, dan Bucket Fill.
* **Shortcut Pintar:** Tahan `Shift` + *Click & Drag* untuk mengatur ukuran kuas (Krita-style). Tahan `Ctrl` saat membuat Ellipse/Rectangle untuk mengunci bentuk (Lingkaran/Persegi Sempurna).

### 📚 Sistem Layer Profesional
* Penambahan layer tak terbatas dengan fungsi *Drag & Drop* untuk mengurutkan.
* Dukungan penuh terhadap atribut layer tingkat lanjut: **Opacity**, **Blend Modes** (Multiply, Screen, Overlay, dll), **Alpha Lock**, dan **Clipping Mask**.

### 🎬 Timeline & Animasi 2D
* Buat animasi *frame-by-frame* langsung di browser.
* Dilengkapi fitur **Onion Skinning** (menampilkan bayangan tipis frame sebelum/sesudah untuk referensi gerakan animasi).
* Kontrol durasi (FPS) yang dapat disesuaikan.

### 🤖 AI Copilot (Gemini Assistant)
* Integrasi panel AI cerdas yang siap menjawab pertanyaan seputar *digital painting*, memberi saran warna, atau memandu penggunaan aplikasi.
* Menggunakan `@google/genai` lewat backend proxy lokal.

### 🖼️ Manipulasi & Efek
* **Selection Tools:** Rectangle Select dan Lasso Select dengan fitur Move (Geser), Copy, Cut, dan Fill.
* **Real-time Filters:** Berikan efek (Blur, Grayscale, Sepia, Invert, dll) pada layer yang aktif.
* **Jendela Referensi:** *Floating window* (jendela melayang) tempat pengguna memuat gambar referensi sambil menggambar.

### 💾 Format Proyek Mandiri
* Berkat arsitektur berbasis `JSZip`, proyek (berisi layer dan animasi) dapat disimpan dalam ekstensi eksklusif `.dwp` dan dimuat ulang kapan saja secara utuh (Offline-First tanpa basis data).

---

## 🛠️ Tech Stack

* **Framework:** React 19 + TypeScript + Vite
* **Styling:** Tailwind CSS + Lucide React (Icons)
* **Grafis:** HTML5 `CanvasRenderingContext2D` dengan implementasi *Dirty Rectangle Compositing* untuk optimalisasi render.
* **API AI:** Express.js (Proxy Lokal API `/api/chat`), `@google/genai`
* **File Management:** `jszip`

---

## 🚀 Cara Menjalankan Secara Lokal (Development)

Pastikan Anda memiliki [Node.js](https://nodejs.org/) yang terinstal di sistem Anda.

1. **Kloning atau Unduh repositori ini**
2. **Instal seluruh *dependencies*:**
   ```bash
   npm install
   ```
3. **Konfigurasi Environment:**
   * Ganti nama `.env.example` menjadi `.env` (atau buat file `.env` baru).
   * Masukkan API Key Google Gemini Anda:
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     GEMINI_MODEL=gemini-1.5-flash
     ```
4. **Jalankan Aplikasi Mode Development (Frontend & API Bridge):**
   ```bash
   npm run dev
   ```
5. **Akses Aplikasi:**
   Buka peramban Anda di [http://localhost:5173](http://localhost:5173).

---

## 📦 Build untuk Produksi

Jika Anda ingin membungkus (*build*) aplikasi untuk deployment ke server statis seperti Vercel, Netlify, atau Hostinger:

```bash
npm run build
```
File siap *deploy* akan digenerate di dalam folder `dist/`.

*(Catatan: Anda akan memerlukan server/serverless backend tersendiri untuk menangani rute `/api/chat` jika fitur AI ingin digunakan di production, karena alasan keamanan API Key).*

---

## ⌨️ Keyboard Shortcuts Penting

* `Ctrl` + `Z` : Undo
* `Ctrl` + `Y` : Redo
* `Ctrl` + `S` : Simpan (*Save Dialog*)
* `B` : Brush
* `E` : Eraser
* `Shift` + *Click & Drag* : Ubah ukuran Brush
* `Ctrl` + *Drag Shape* : Buat shape (lingkaran/persegi) sempurna
* `Esc` : Batalkan seleksi (*deselect*) atau tutup dialog

---
*Dibuat untuk Tugas Akhir / Skripsi 🎓*
