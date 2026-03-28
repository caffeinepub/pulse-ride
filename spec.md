# PulseRide

## Current State
LiveRideMapPage uses CartoDB dark tiles, Leaflet CDN loader, OSRM routing, and a showSearchScreen state. When user selects address from search, destSnap.current is updated and showSearchScreen=false triggers map init effect. Errors occur on transition. Car animation is emoji-based with setInterval.

## Requested Changes (Diff)

### Add
- Light Uber-style map tiles (CartoDB Voyager - white/light grey)
- Smooth car animation using requestAnimationFrame with linear interpolation between route waypoints
- Uber-style bottom sheet: confirm screen with price, ETA, car type, cash payment button
- Black ETA badge floating on map (like Uber's "3 DK" badge)
- Proper map key to force re-mount when coords change

### Modify
- Fix map initialization: pass coords as props/state instead of refs to avoid stale closure bugs
- Fix transition from search screen to map (use key prop to force remount)
- Car icon: white car SVG/emoji with shadow, rotates to face direction of travel
- Route line: dark/black color like Uber (not blue)
- Map tiles: light voyager theme
- Remove dark overlay, use clean white bottom panel

### Remove
- CartoDB dark tiles
- stale ref-based coord management causing errors

## Implementation Plan
1. Rewrite LiveRideMapPage with a clean 3-phase UI: search → confirm → riding
2. Fix address→map transition by using React state for coords (not just refs)
3. Use voyager light tiles
4. Smooth rAF-based car animation along OSRM route
5. Uber-style confirm panel before ride starts
6. Floating ETA badge on map
