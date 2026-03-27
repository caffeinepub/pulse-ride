# PulseRide — v22: Auto Location & Professional Map

## Current State
- RiderDashboard has two manual inputs: PICKUP ZONE and DROPOFF ZONE (both free text)
- LiveRideMapPage uses a custom Canvas-based renderer with a dark grid, static hardcoded Istanbul coordinates, and no real map tiles
- No geolocation auto-detection exists

## Requested Changes (Diff)

### Add
- Browser Geolocation API auto-detection on RiderDashboard mount
- "Detecting location..." loading state while geolocation resolves
- Display detected location as "GPS SECURED" badge showing approximate neighborhood/coords
- Leaflet.js map in LiveRideMapPage using OpenStreetMap tiles, replacing canvas renderer
- Leaflet map shows: pickup pin (A), destination pin (B), animated driver marker (🚗), route polyline
- Retain all existing cyberpunk HUD overlays on top of the Leaflet map

### Modify
- RiderDashboard ride form: remove PICKUP ZONE input; keep only DROPOFF/DESTINATION input
- calcAiPrice: use detected GPS coords for distance calculation (realistic km based on lat/lng)
- LiveRideMapPage: swap canvas for Leaflet map component with dark/cyberpunk tile layer (CartoDB DarkMatter)
- Driver position animation: use Leaflet marker that moves smoothly via repeated setLatLng
- Pre-match phase: show blurred/approximate pickup location on map
- Post-match: show exact route and animated driver marker

### Remove
- ENCRYPTED PICKUP ZONE input field from RiderDashboard
- Canvas element and all canvas draw loop code from LiveRideMapPage
- Hardcoded PICKUP/DESTINATION/DRIVER_START coords in LiveRideMapPage

## Implementation Plan
1. RiderDashboard.tsx:
   - On mount call `navigator.geolocation.getCurrentPosition`
   - Store detected coords in state (`detectedLocation: {lat, lng, label}`)  
   - Show spinner/badge during detection; fallback gracefully if denied
   - Remove pickupZone state and input; pass detected coords to calcAiPrice
   - calcAiPrice updated to accept optional lat/lng for realistic distance
   - Submit ride with detected GPS coords (encrypted label)

2. LiveRideMapPage.tsx:
   - Replace canvas with react-leaflet MapContainer + TileLayer (CartoDB DarkMatter tiles)
   - Add custom CSS for leaflet dark theme inside component
   - Pickup marker (green pin), Destination marker (purple pin)
   - Driver marker starts at DRIVER_START, animates to PICKUP then DESTINATION via useEffect interval
   - Route polyline between pickup and destination (cyan dashed)
   - Pre-match: driver marker hidden/blurred using CSS filter on map container
   - All existing HUD overlays (panic, phase labels, ETA, bottom panel) remain as absolute positioned divs on top
   - Map tiles: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
