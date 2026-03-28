# PulseRide

## Current State
PulseRide is a feature-rich anonymous ride-sharing platform with a cyberpunk dark UI (neon purple/cyan on dark backgrounds). It has LandingPage, RiderDashboard, DriverDashboard, LiveRideMapPage, and multiple special feature pages. The app has no bottom navigation bar — all navigation is page-based.

## Requested Changes (Diff)

### Add
- Bottom navigation bar (tab bar) on main app screens (Landing, Rider, Driver dashboards) similar to Uber/Yandex style: clean, white/light background, icon + label tabs
- App-wide professional color scheme update to match Uber/Yandex aesthetic: dark navy/black primary, bright blue (#276EF1 Uber blue) as accent, clean whites and grays

### Modify
- LandingPage: Redesign to Uber/Yandex-like professional look with clean bottom bar showing tabs: Home, Ride, Drive, Messages (Ghost Chat), More
- RiderDashboard: Professional clean layout with white cards, dark header, Uber blue accents, bottom tab bar
- DriverDashboard: Same professional treatment
- index.css: Update color tokens to professional Uber-like palette while preserving all animations
- All feature pages: Keep all existing functionality but update colors to be consistent

### Remove
- Excessive neon glow effects on the main landing page (keep subtle ones)
- Overly dark cyberpunk styling on rider/driver dashboards (keep ghost/phantom feature styling)

## Implementation Plan
1. Add a shared BottomTabBar component with 5 tabs: Home, Rider, Driver, Chat, More
2. Update index.css to add Uber-like CSS variables and professional color utilities
3. Redesign LandingPage with professional Uber/Yandex-inspired layout + BottomTabBar
4. Update RiderDashboard and DriverDashboard with professional card styles and bottom bar
5. All other pages (GhostChat, GhostGroup, etc.) keep existing styling but get bottom safe area padding
