# PulseRide v29 — Profesyonellik Paketi

## Current State
- Tek sayfa Uber-style layout (HomePage) — harita arka plan, sol üst Yolcu/Şoför toggle
- LiveRideMapPage: SEARCH → CONFIRM → RIDING faz makinesi, Leaflet harita, OSRM rota, araç animasyonu
- Tüm ghost özellikler (GHOST CHAT, GHOST COMM, GHOST GROUP, GHOST ALARM, GHOST DÜELLO vb.) mevcut
- Alt navigasyon çubuğu, PWA desteği, Uber/Yandex teması

## Requested Changes (Diff)

### Add
1. **Son adresler listesi** — localStorage'da son 5 adres saklanır, arama ekranında "Son Adresler" başlığıyla listelenir. Seçince direkt CONFIRM fazına geçer.
2. **Tahmini süre & fiyat önizlemesi** — CONFIRM panelinde mevcut (OSRM'den), ama arama sonucu seçilince de küçük bir "Tahmini ~X dk / ₺Y" badge gösterilsin.
3. **Sürücü yakınlık göstergesi** — HomePage'de Şoför modunda "3 sürücü yakında" animasyonlu badge; Yolcu modunda "Yolcu aranıyor" spinner eşleşme bekleme simülasyonu.
4. **Yolculuk özeti ekranı** — RIDING fazı tamamlandığında (rideCompleted) tam ekran özet kart gösterilir: süre, mesafe, fiyat, karma puanı +2, anonymous sürücü bilgisi, "Yeni Yolculuk" butonu.
5. **Karanlık/Açık mod toggle** — TopBar'da sağ üst köşeye 🌙/☀️ butonu. `dark` class ana div'e eklenir. Tüm sayfalar dark mod renk tokenlarını alır.
6. **Harita tam ekran butonu** — RIDING fazında alt panel üzerinde ▲/▼ butonu, alt paneli küçültür/genişletir.

### Modify
- LiveRideMapPage: rideCompleted → yolculuk özeti ekranı göster (mevcut tamamlandı banner'ı yerine)
- LiveRideMapPage: SEARCH ekranına son adresler bölümü ekle
- HomePage: sürücü yakınlık badge'i ve yolcu eşleşme spinner ekle
- Tema sistemi: `useDarkMode` hook + localStorage persist

### Remove
- Küçük "Yolculuk tamamlandı" banner'ı (yerine tam ekran özet kart geliyor)

## Implementation Plan
1. `useDarkMode` hook yaz (localStorage persist, body class toggle)
2. HomePage'e dark mod toggle, sürücü yakınlık animasyonu, yolcu eşleşme spinner ekle
3. LiveRideMapPage'e son adresler (localStorage), tam ekran toggle, yolculuk özeti ekranı ekle
4. Tüm dosyalara dark mod class desteği
