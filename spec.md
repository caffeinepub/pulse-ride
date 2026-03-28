# PulseRide

## Current State
LiveRideMapPage mevcut haliyle CartoDB dark tiles kullanıyor ama harita etkileşimi devre dışı (drag, zoom kapalı), rota düz çizgi, araba animasyonu basit, gerçek routing yok.

## Requested Changes (Diff)

### Add
- OSRM API ile gerçek yol rotası çekme (router.project-osrm.org)
- Araba ikonu gerçek rota boyunca smooth animasyon
- Harita tam etkileşimli (drag, zoom, her şey açık)
- Uber benzeri profesyonel UI: üstte adres bar, altta bilgi paneli
- Başlangıç (A) ve bitiş (B) noktası işaretleri profesyonel
- Rota üzerinde adım adım waypoint listesi
- ETA ve mesafe gerçek OSRM verisinden
- Araç rotayı tamamladığında animasyon biter
- Geocoding: adres yazınca Nominatim ile arama önerileri

### Modify
- Harita kontrolleri tamamen açılacak (drag/zoom/touch hepsi)
- Tile layer CartoDB dark kalacak ama attribution gösterilecek
- Rota düz çizgiden gerçek yol geometrisine çevrilecek
- Araç animasyonu lerp yerine rota waypoint'leri üzerinde segment bazlı

### Remove
- `dragging={false}`, `scrollWheelZoom={false}`, `doubleClickZoom={false}`, `touchZoom={false}` kısıtlamaları

## Implementation Plan
1. LiveRideMapPage tamamen yeniden yaz
2. OSRM API'den rota geometrisi çek (geojson)
3. Araç animasyonu rota segmentleri üzerinde ilerlesin
4. Harita tüm etkileşimlere açık
5. Uber benzeri bottom sheet: sürücü bilgisi, ETA, mesafe, faz
6. Nominatim autocomplete adres arama (opsiyonel prop)
7. Mevcut PulseRide cyberpunk HUD korunacak
