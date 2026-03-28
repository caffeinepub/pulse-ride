# PulseRide — Teslimat Entegrasyonu (Tek Sayfa)

## Current State
Teslimat sistemi (GhostDeliveryPage) ayrı bir tam sayfa olarak açılıyor. Ana harita sayfası (HomePage) Yolcu/Şöfür toggle'ına sahip, alt panel içeriği role göre değişiyor. Teslimat sekmesi chip olarak mevcut fakat ayrı sayfaya yönlendiriyor.

## Requested Changes (Diff)

### Add
- Top bar role toggle'a üçüncü seçenek: **Teslimat** (Yolcu | Şöfür | Teslimat)
- Role === "delivery" olduğunda alt panel içinde 6 adımlı teslimat akışı (GhostDeliveryPage mantığı, inline)
- Harita arka planda görünür kalmaya devam eder
- Teslimat takip adımında harita inline map container ile alt panelde gösterilir

### Modify
- HomePage top bar: 2'li toggle → 3'lü toggle (Yolcu | Şöfür | Teslimat)
- CHIPS listesinden "Teslimat" chip'i kaldırılır (artık top toggle'da)
- GhostDeliveryPage'deki tüm adımlar (create, pricing, matching, tracking, code, summary) HomePage'in alt paneline taşınır
- Alt panel yüksekliği teslimat modunda scroll destekli olur
- onGhostDelivery prop ve ayrı sayfa yönlendirmesi kaldırılır

### Remove
- Teslimat için ayrı sayfa navigasyonu
- CHIPS içindeki Teslimat butonu

## Implementation Plan
1. HomePage.tsx'e delivery state ve tüm GhostDeliveryPage state'lerini ekle
2. Top bar toggle'ı 3 seçenekli yap (Yolcu / Şöfür / Teslimat)
3. role === 'delivery' panelini inline delivery flow olarak implemente et (AddressInput, tüm adımlar)
4. Tracking adımında alt panelde harita göster (leaflet, küçük inline map)
5. GhostDeliveryPage'deki helper componentleri (MatchingStep, SummaryStep, AddressInput) HomePage içine taşı veya import et
6. CHIPS'ten Teslimat'ı çıkar, App.tsx'te onGhostDelivery'nin artık gerekmediğini işaretle (prop opsiyonel kalabilir)
7. Validate
