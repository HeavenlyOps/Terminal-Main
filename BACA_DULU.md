# Nusantara — terminal saham lokal, versi 0.6

Terminal lokal untuk saham Indonesia dan IHSG: grafik candlestick/garis, volume, 40 jenis indikator,
watchlist dengan harga dan perubahan persen, berita per emiten, pencarian kode,
enam rentang waktu, dan pembaruan otomatis. Workspace kini mendukung widget yang
bisa digeser, diubah ukurannya, dan ditampilkan atau ditutup sesuai kebutuhan.
Versi 0.6 menambah dua panel indikator dan heatmap saham watchlist.

## Memperbarui dari versi sebelumnya

1. Di jendela CMD aplikasi lama, tekan **Ctrl+C** untuk menghentikannya.
2. Ekstrak ZIP versi baru. Salin **seluruh isinya** ke folder aplikasi lama dan
   pilih **Replace/Ganti** jika diminta. Folder `.venv` lama tidak ada di ZIP
   sehingga tidak tertimpa. Pastikan semua file serta folder `templates`
   dan `static` juga ikut tersalin.
3. Jalankan `MULAI.bat` kembali, lalu muat ulang halaman browser dengan
   **Ctrl+F5**. Tidak perlu memasang OpenBB atau memasukkan API key.

Alternatif: ekstrak ke folder baru dan jalankan `MULAI.bat` dari sana. Skrip
akan menyiapkan `.venv` baru. Hentikan aplikasi lama terlebih dahulu agar
tidak berebut port 5000.

## Mulai memakai indikator dan heatmap

1. Buka saham, misalnya **BBCA**. Klik **ƒx Indikator** pada toolbar grafik.
2. Untuk mulai, pilih preset **Dasar**: SMA 20/50/200, RSI, dan MACD.
   SMA 200 memerlukan setidaknya 200 candle. Gunakan **1Y + 1 hari** bila
   ingin melihat SMA 200 harian; jika riwayat belum cukup, aplikasi memberi catatan.
3. Tab **Di grafik** berisi garis/band yang bisa dicentang bersamaan. Ubah
   parameter pada indikator yang aktif, lalu tekan Tab atau klik di luar input.
   Tombol **×** pada chip di atas grafik menonaktifkan indikator itu.
4. Tab **Panel indikator** menyediakan 27 pilihan untuk **Panel 1** atau
   **Panel 2**. Pilihan juga bisa diganti langsung dari menu masing-masing widget.
   Buka **Pengaturan** untuk mengubah periode; **Tentang indikator** menjelaskan rumusnya.
5. Coba preset **Tren**, **Volatilitas**, atau **Volume**. Preset mengganti
   pilihan dan parameter indikator; **Hapus overlay** hanya mematikan garis/band.
   Pencarian membantu menemukan nama indikator. Klik **Selesai** untuk kembali.
6. Lihat **Watchlist Heatmap** di bawah panel indikator. Klik kotak saham
   untuk membuka grafik dan beritanya. Tambah/hapus saham lewat widget Watchlist.

Pilihan, parameter, dan susunan tersimpan otomatis di browser/alamat yang sama.
Saat memperbarui dari v0.5, susunan lama dipertahankan dan tiga widget baru
ditambahkan di bawahnya. Jika belum terlihat, scroll ke bawah atau gunakan
**Add Widget**. **Reset Layout** menampilkan susunan awal v0.6.
Tidak ada dependensi Python tambahan untuk fitur indikator dan heatmap.

### 40 jenis indikator

| Kelompok | Indikator |
| --- | --- |
| Garis dan band di grafik (13 jenis) | SMA, EMA, WMA, HMA, DEMA, TEMA, VWMA, VWAP sesi, Bollinger Bands, Keltner Channels, Donchian Channels, Supertrend, Ichimoku Cloud |
| Momentum (13 jenis) | RSI, MACD, Stochastic, Stochastic RSI, CCI, ROC, Momentum, Williams %R, Ultimate Oscillator, Awesome Oscillator, PPO, TRIX, Balance of Power |
| Tren (2 jenis) | ADX + DMI, Aroon |
| Volatilitas (5 jenis) | ATR, NATR, Standard Deviation, Bollinger Bandwidth, Bollinger %B |
| Volume (7 jenis) | OBV, Money Flow Index, Chaikin Money Flow, Accumulation / Distribution, Chaikin Oscillator, Volume Price Trend, Force Index |

SMA mempunyai tiga slot awal (20/50/200) dan EMA tiga slot (9/21/50), sehingga
ada **17 pilihan overlay** dari 13 jenis. Periode setiap slot dapat diubah.
Dua panel terpisah masing-masing menampilkan satu dari 27 indikator panel;
MACD, ADX, dan indikator majemuk menampilkan semua komponennya di panel yang sama.
Grafik indikator mengikuti kode, rentang, dan interval grafik utama. Zoom/pan
di setiap panel berdiri sendiri. Warna garis mengikuti chip atau nama komponennya.

### Cara membaca hasil perhitungan

- **Periode adalah jumlah candle**, bukan selalu hari. RSI 14 pada candle
  5 menit memakai 14 perubahan candle 5 menit; pada candle harian memakai
  perubahan harian. Awal seri yang belum cukup data dibiarkan kosong.
- Perhitungan memakai **candle yang tersedia pada rentang terpilih**. Versi
  ini belum mengambil riwayat tambahan sebelum awal rentang untuk pemanasan.
  EMA dan indikator kumulatif dapat berubah ketika awal rentang berubah.
- EMA dimulai dari SMA dan memakai faktor 2/(n+1). Smoothing Wilder memakai
  faktor 1/n dengan seed SMA. Seed tiap EMA MACD dihitung sendiri. Nilai awal
  ADX/DMI, Chaikin, dan MACD dapat berbeda dari platform dengan seed lain.
- Supertrend memakai ATR Wilder dan arah awal turun sebelum pergantian
  pertama, mengikuti aturan band pada dokumentasi TradingView. Seed ATR
  dan riwayat sumber tetap dapat menyebabkan perbedaan antarplatform.
- Bollinger memakai standar deviasi populasi. Keltner adalah varian modern
  EMA Close ± pengali ATR. Donchian menyertakan candle saat ini. HMA membulatkan
  n/2 dan akar n ke bawah; Aroon memakai n+1 candle dan ekstrem terbaru saat seri.
- Ichimoku menampilkan Tenkan, Kijun, Span A dan B. Cloud digeser sebanyak
  periode Kijun; bagian di luar candle yang tersedia tidak digambar. Chikou
  belum disertakan. Karena itu tampilannya tidak identik dengan Ichimoku lengkap.
- VWAP memakai harga tipikal dan dimulai ulang setiap tanggal WIB; hanya
  tersedia pada interval intraday. Jika rentang dimulai di tengah sesi, VWAP
  hanya mencakup candle sesi yang berhasil diambil.
- VWAP/VWMA dan indikator volume memerlukan volume saham. Pada IHSG,
  indikator tersebut menampilkan keterangan tidak tersedia, bukan angka nol.
- Seri benar-benar datar menghasilkan RSI/MFI/Stochastic/Stochastic RSI 50,
  Williams %R −50, dan Ultimate Oscillator 50. Pembagi nol pada %B, VWMA,
  dan rasio lain yang tidak terdefinisi menghasilkan celah, bukan angka buatan.
- Angka di atas panel adalah nilai candle terakhir. Candle berjalan masih
  dapat berubah; harga sumber tidak disesuaikan untuk aksi korporasi.

### Heatmap watchlist

- Cakupannya **saham yang ada di watchlist**, bukan seluruh saham BEI atau
  konstituen indeks tertentu. IHSG tetap muncul pada kartu Market.
- Hijau = naik, merah = turun, abu-abu = tetap atau data tidak tersedia.
  Persentase membandingkan Close sesi terbaru yang tersedia dengan Close
  sesi sebelumnya, memakai data yang sama dengan watchlist.
- Kotak **sama besar**, bukan bobot kapitalisasi pasar. Intensitas warna
  mencapai maksimum pada ±5%; angka perubahan tetap ditampilkan apa adanya.
- Tanggal sesi terlihat di setiap kotak. Arahkan kursor untuk melihat nama
  emiten dan waktu pengambilan. Data gagal/usang tidak diberi warna seolah baru.
  Jika tanggal sesi antar saham berbeda, panel memberi catatan.
- Urutan bisa berdasarkan kode atau perubahan persen. Refresh mengikuti
  **Auto 60 dtk** dan **Perbarui**; heatmap tidak membuat permintaan harga tambahan.
  Data tetap tertunda sesuai sumber.

## Workspace widget

- Susunan awal berisi **Price Chart**, **Watchlist**, **Market / IHSG**, **News**,
  **Indikator 1**, **Indikator 2**, dan **Heatmap**.
- **Geser judul panel** atau pegangan **⋮⋮** untuk memindahkan widget. Widget
  lainnya bergeser agar tidak saling menutupi. Geser isi grafik tetap untuk pan.
- Tarik **sudut kanan bawah** untuk mengubah lebar dan tinggi panel. Grafik
  menyesuaikan ukurannya otomatis. Setiap jenis widget punya ukuran minimum.
- Klik **× pada judul panel** untuk menutup widget. Buka kembali dari daftar
  **Add Widget** di kiri. **Ringkasan**, **Status Data**, dan **Tabel Candle**
  tersedia di daftar itu. Setiap jenis hanya dapat ditampilkan satu kali.
- Susunan dan widget yang tampil tersimpan otomatis di browser. Berlaku untuk
  browser dan alamat/port yang sama; menghapus data situs ikut menghapus susunan.
- **Reset Layout** mengembalikan tujuh widget awal. Watchlist dan parameter indikator tidak dihapus.
- Pada layar sempit, widget ditumpuk satu kolom. Susunan desktop disimpan untuk
  dipulihkan ketika ruang layar kembali cukup lebar.
- Untuk keyboard, tekan Tab sampai pegangan **⋮⋮** terpilih. Tombol panah
  menggeser panel; **Shift + panah** mengubah ukuran.
- Kartu **Market / IHSG** selalu memakai IHSG, meskipun kamu membuka BBCA atau
  saham lain. Nilai dalam **poin**, perubahan poin/persen dibanding Close sesi
  sebelumnya. Tanggal sesi dan waktu pengambilan ditampilkan agar jelas.
- Kartu IHSG bekerja meskipun IHSG dihapus dari watchlist atau daftar sudah
  penuh. **Buka grafik & berita IHSG** pada kartu memilih IHSG untuk panel lain.
- IHSG diperiksa setiap sekitar 60 detik saat **Auto 60 dtk** aktif; tombol
  **Perbarui** juga memeriksanya. Cache harga tetap dibagi dengan watchlist.
- Jika pengambilan gagal, angka lama ditandai dengan waktu aslinya. Tidak ada
  harga buatan. Data Yahoo tetap tertunda, bukan feed real-time tanpa delay.
- SMA 20 dari versi sebelumnya tetap tersedia melalui tombol cepat di toolbar.

## IHSG di versi 0.4

- Klik tombol **IHSG — Indeks pasar Indonesia** di kiri, atau ketik **IHSG**
  pada pencarian utama lalu klik **Buka**. Grafik dan berita mengikuti IHSG.
- Aplikasi memetakan **IHSG**, **JKSE**, dan **^JKSE** ke simbol Yahoo **^JKSE**.
  IHSG adalah indeks: nilai Open/High/Low/Close dan watchlist ditampilkan dalam
  **poin**, bukan rupiah. Saham biasa tetap memakai akhiran `.JK` dan satuan IDR.
- Pilihan rentang 1D sampai 1Y, interval candle, grafik garis, SMA 20, dan zoom
  juga berlaku untuk IHSG. Ketersediaan intraday mengikuti Yahoo. Jika interval
  tertentu belum tersedia, aplikasi memberi pesan kesalahan; tidak mengarang
  candle pengganti. Coba rentang 1Y dengan candle harian untuk melihat riwayat.
- Panel volume hanya ditampilkan untuk saham pada versi ini. Volume IHSG tidak
  disajikan sebagai volume lembar saham; tabel IHSG menampilkan OHLC saja.
- **BERITA IHSG** memakai pencarian IHSG, Indeks Harga Saham Gabungan, Jakarta
  Composite, IDX Composite, dan JKSE. Sumber Google News dan ANTARA tetap
  disaring menurut kata kunci tersebut, diurutkan terbaru, dan diperiksa
  sekitar dua menit sekali. Hasil tidak menjamin mencakup seluruh berita pasar.
- Untuk memantau nilai dan perubahan persen IHSG di watchlist, ketik **IHSG**
  pada kotak tambah kode lalu tekan **+**. Nama alias tidak menambah duplikat.
  Daftar awal pengguna baru menyertakan IHSG. Watchlist yang sudah tersimpan
  tetap digunakan; tombol IHSG di kiri tersedia meskipun indeks belum masuk
  daftar atau watchlist sudah penuh.
- Grafik dan watchlist tetap memakai data Yahoo yang **tertunda**. Pembaruan
  otomatis dan feed berita bukan layanan real-time tanpa delay.

## Perbaikan grafik di versi 0.3

- **RENTANG** mengatur berapa lama riwayat yang terlihat. **CANDLE** mengatur
  durasi satu batang. Contoh: **1D + 5 menit** berarti satu hari perdagangan,
  dengan satu candle untuk setiap interval lima menit yang tersedia.
- Default 1D sekarang memakai candle **5 menit** agar tidak terlalu rapat.
  Menu CANDLE tetap menyediakan 1, 5, 15, dan 30 menit. Rentang panjang
  3M/6M/1Y menyediakan candle **1 hari** atau **1 minggu**. Mengganti rentang
  mengembalikan interval ke default rentang tersebut.
- Jarak antar candle dibuat sama; jam istirahat, hari libur, dan periode
  tanpa data candle tidak menyisakan ruang kosong. Ini hanya pemadatan sumbu
  waktu, bukan pengisian data. Waktu asli tetap terlihat saat kursor diarahkan
  ke candle dan pada tabel. Jarak visual tidak menunjukkan lamanya jeda.
- Tombol **+** memperbesar bagian kanan grafik, **−** memperlebar rentang
  yang terlihat, dan **⤢** mengembalikan seluruh rentang. Skala harga mengikuti
  candle yang terlihat dan SMA bila diaktifkan. Scroll dan geser tetap tersedia.
- Angka skala harga tidak lagi membulatkan 25,5 menjadi 26, sehingga label
  yang berulang pada rentang sempit dapat dibedakan.
- Open = Close menghasilkan badan candle yang datar. Jika Open, High, Low,
  dan Close semuanya sama, seluruh candle tampak sebagai garis kecil.
  Aplikasi menampilkan catatan jika setidaknya 10% candle memiliki keempat
  harga yang sama. Data sumber dipertahankan tanpa interpolasi harga.
- Mengubah interval dapat membuat candle lebih mudah dibaca, tetapi tidak
  menjamin bentuk candle berubah jika harga memang hanya berputar di level
  yang sama. Arahkan kursor ke candle atau cek tabel OHLC untuk memeriksanya.

## Watchlist dan berita per emiten

- Watchlist berada di panel **Watchlist**. Masukkan kode saham di kotak tambah kode
  lalu tekan **+** atau Enter. Maksimal 12 kode saham/indeks. Tombol **×** menghapus saham
  dari watchlist, tanpa menutup grafik saham yang sedang dibuka.
- Daftar tersimpan di localStorage browser pada alamat aplikasi yang sama.
  Menutup aplikasi tidak menghapusnya. Menghapus data situs, mode privat,
  mengganti browser atau mengganti port dapat membuat daftar berbeda.
- Harga watchlist diperiksa sekitar sekali per menit. Persentase dihitung
  dari Close candle harian terakhir yang tersedia dibanding Close sesi
  sebelumnya, bukan dibanding candle grafik sebelumnya. Arahkan kursor ke
  baris untuk melihat tanggal sesi dan waktu pengambilan.
- Harga harian watchlist dan candle intraday grafik bisa diperbarui pada
  waktu berbeda oleh Yahoo. Keduanya tetap merupakan data tertunda.
- Klik saham di watchlist atau gunakan pencarian utama: **grafik dan berita
  langsung mengikuti emiten yang dipilih**. Berita tidak ikut berubah saat
  kamu hanya mengganti rentang waktu grafik.
- Panel berita memakai pencarian **Google News RSS** berdasarkan kode/nama
  emiten, ditambah feed resmi **ANTARA Bursa dan Finansial**. Kelima emiten
  awal juga punya nama/alias; kode saham lainnya memakai pencarian kode.
- Hasil disaring menurut kode/nama pada judul atau ringkasan feed, diurutkan
  berdasarkan waktu publikasi terbaru, dan dideduplikasi. Ditampilkan maksimal
  20 berita berumur 30 hari atau kurang. Cakupan bergantung pada item yang
  tersedia dalam feed; tidak mencakup semua berita di internet. Berita dapat
  membahas beberapa emiten sekaligus.
- Setiap berita menampilkan nama sumber, waktu publikasi dalam WIB, dan judul
  yang bisa diklik. Artikel dibuka di tab baru melalui tautan feed; Google News
  dapat mengarahkan ke penerbit. Isi lengkap artikel tidak disalin ke aplikasi.
- **Auto 2 menit** memeriksa berita sekitar sekali setiap dua menit saat tab
  terlihat. Tombol **↻** di panel berita memeriksa manual. Cache sumber juga
  berlaku selama 120 detik, sehingga klik berulang tidak memaksa data baru.
- Ini **pembaruan berkala, bukan streaming berita tanpa delay**. Publikasi,
  indeks Google, dan pembaruan feed memiliki keterlambatan yang tidak dapat
  dihilangkan dengan mempercepat refresh. Google News RSS adalah feed publik;
  struktur/ketersediaannya dapat berubah.
- **Status sumber berita** menunjukkan sumber yang berhasil/gagal beserta
  waktu terakhir diambil. Jika sebagian sumber gagal, sumber lainnya tetap
  digunakan. Jika refresh gagal, hasil lama diberi peringatan; aplikasi tidak
  membuat judul berita atau harga pengganti.

Tombol **Perbarui** utama memeriksa grafik, watchlist, IHSG, dan berita. Auto 60 dtk
mengatur grafik/watchlist/IHSG; Auto 2 menit mengatur berita secara terpisah.

## Menjalankan di Windows

1. Ekstrak ZIP terlebih dahulu. Jangan menjalankan file langsung dari dalam ZIP.
2. Buka folder hasil ekstrak yang berisi `MULAI.bat` dan `app.py`.
3. Klik dua kali `MULAI.bat`. Pada penggunaan pertama, skrip membuat lingkungan
   Python `.venv` di folder ini dan memasang dependensi jika diperlukan.
4. Browser akan terbuka di **http://127.0.0.1:5000**. Jika tidak, buka alamat itu
   secara manual. Biarkan jendela CMD tetap terbuka.
5. Untuk menghentikan aplikasi, tekan **Ctrl+C** di CMD.

Python harus sudah terpasang dan tersedia sebagai perintah `python`.
Internet diperlukan untuk pemasangan awal dan pengambilan data saham.
Grafik memakai Plotly dan widget memakai GridStack 14.0.0 yang sudah disertakan
di folder static/vendor, beserta lisensinya. Tidak perlu Node.js, npm, atau CDN.

### Memakai folder dan .venv yang sudah kamu buat

Jika sebelumnya sudah membuat `%USERPROFILE%\terminal-saham`, kamu dapat
menyalin seluruh isi folder aplikasi ke folder tersebut. Jangan menyalin hanya
`app.py`: folder `templates` dan `static` juga dibutuhkan. `.venv` lama tetap
digunakan oleh `MULAI.bat` apabila tersedia.

Alternatif melalui CMD (jalankan dari folder yang berisi `app.py`):

```bat
.venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

Jika port 5000 sedang dipakai, jalankan `python app.py --port 5001`, lalu buka
http://127.0.0.1:5001. Aplikasi secara default hanya mendengarkan di komputer
lokal, dengan debug dimatikan.

## Memakai terminal

- Klik BBCA, BBRI, BMRI, TLKM, atau ASII di watchlist untuk membuka grafik dan
  berita emiten tersebut.
- Untuk IHSG, klik tombol IHSG di kiri. Untuk saham BEI lain, masukkan kodenya,
  misalnya `ADRO`, lalu klik **Buka**. Akhiran `.JK` ditambahkan untuk saham;
  IHSG dipetakan ke `^JKSE`.
- **1D** menampilkan hari perdagangan terakhir yang tersedia dengan candle
  5 menit secara default. Saat libur atau sebelum sesi buka, hari tersebut dapat berupa hari
  perdagangan sebelumnya. **5D** memakai 5 menit, **1M** memakai 30 menit,
  **3M/6M/1Y** memakai candle harian. Interval bisa diganti melalui menu CANDLE.
- Gunakan menu **Candle/Garis** untuk mengganti grafik. SMA 20 adalah rata-rata
  20 harga penutupan candle yang tampil; 19 candle pertama belum punya nilai
  SMA. Ubah interval untuk mengubah panjang waktu yang diwakili SMA.
- Scroll untuk zoom, geser grafik untuk pan. Klik dua kali atau gunakan tombol
  reset zoom untuk kembali melihat seluruh rentang.
- **Auto 60 dtk** memeriksa pembaruan kira-kira sekali setiap menit saat tab
  terlihat. **Perbarui** memeriksa secara manual. Server menyimpan hasil selama
  60 detik per saham/rentang/interval, sehingga klik berulang tidak memaksa data baru.

## Membaca datanya dengan benar

- Sumber: Yahoo Finance melalui pustaka tidak resmi yfinance.
- Data BEI dari Yahoo **tertunda**, bukan feed bursa real-time tanpa delay.
  Yahoo mencantumkan keterlambatan 10 menit untuk IDX. Refresh otomatis tidak
  menghapus keterlambatan ini. Ketersediaan dan waktu pembaruan dapat bervariasi.
- **Candle terakhir** adalah waktu candle dari penyedia; pada data intraday,
  timestamp biasanya menunjukkan awal interval. **Data diambil** adalah saat
  aplikasi selesai mengambil respons. Keduanya berbeda dan ditampilkan dalam
  WIB. Timestamp candle harian tidak menunjukkan jam transaksi terakhir.
- Harga utama adalah Close candle terakhir, bukan jaminan harga transaksi
  bursa saat ini. Candle terakhir bisa masih terbentuk. Harga tidak disesuaikan
  untuk aksi korporasi (`auto_adjust=False`).
- Ringkasan Open/High/Low/Volume mengikuti seluruh rentang grafik yang dipilih.
  Volume adalah penjumlahan volume candle yang dikembalikan penyedia, dalam
  lembar saham. Jika ada data yang hilang, ringkasan hanya mencakup data tersedia.
- Tidak ada angka contoh yang menggantikan kegagalan pengambilan data.
  Jika refresh gagal, aplikasi memberi peringatan dan mempertahankan hasil
  sebelumnya untuk saham/rentang yang sama beserta waktu pengambilannya.

Jika data kosong atau Yahoo membatasi permintaan, periksa koneksi/kode saham,
tunggu sekitar satu menit, lalu coba lagi. Jika masih gagal, kirim screenshot
pesan di halaman dan di CMD. Jangan meningkatkan frekuensi refresh untuk
mengatasi pembatasan.

## File yang nantinya bisa dikustomisasi

| File | Fungsi |
| --- | --- |
| `app.py` | Pengambilan data, validasi kode, dan cache |
| `market_data.py` | Harga watchlist, feed berita, dan cache sumber |
| `instruments.py` | Pemetaan IHSG ke ^JKSE, kode saham, nama, satuan, dan alias berita |
| `templates/index.html` | Susunan panel dan isi halaman |
| `static/style.css` | Warna, ukuran, tata letak, dan tampilan ponsel |
| `static/app.js` | Grafik, pilihan saham, dan pembaruan otomatis |
| `static/widgets.js` | Watchlist tersimpan, berita, dan sinkronisasi pilihan emiten |
| `static/indicators.js` | Katalog, rumus, validasi parameter, dan perhitungan indikator |
| `static/indicator-ui.js` | Menu indikator, pilihan tersimpan, dan kedua panel grafik |
| `static/heatmap-model.js`, `static/heatmap.js` | Warna dan interaksi heatmap watchlist |
| `static/analysis.css` | Tampilan indikator dan heatmap |
| `static/layout-state.js`, `static/workspace.js` | Susunan tersimpan dan widget yang dapat dipindahkan |
| `static/vendor/plotly.min.js` | Pustaka grafik yang disertakan |

Crypto dan saham AS belum disertakan dalam versi ini. OpenBB belum diperlukan.

## Rujukan

- Yahoo: https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html
- yfinance: https://ranaroussi.github.io/yfinance/
- Flask: https://flask.palletsprojects.com/
- Plotly.js: https://plotly.com/javascript/candlestick-charts/
- Feed ANTARA: https://www.antaranews.com/rss?mobile=true
- Google News: https://news.google.com/
- Rumus Supertrend: https://www.tradingview.com/support/solutions/43000634738-supertrend/
- Pembanding perhitungan saat pengembangan: https://ta-lib.org/functions/

Chart menggunakan Plotly.js dengan lisensi MIT yang disertakan dalam
`static/vendor/LICENSE-plotly.txt`. Kode aplikasi ini dibuat untuk proyek lokal
kamu. Tidak ada akun, API key, atau konfigurasi hosting yang diperlukan.
