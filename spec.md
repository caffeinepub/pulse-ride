# PulseRide — Ghost Chat In-Ride Integration

## Current State
- GhostChatPage exists as a standalone page with full Ghost Chat features (P2P password-based channels, auto-delete, emoji, attachments, voice call)
- RiderDashboard has rideStatus states: idle, pricing, searching, active, completed
- DriverDashboard has activeRide state (null when no ride, populated when driver accepts a ride)
- No Ghost Chat exists inside either dashboard — only accessible from main landing page

## Requested Changes (Diff)

### Add
- Embedded Ghost Chat modal/overlay in RiderDashboard that opens when rideStatus === "active" or "searching" (after price approval and ride is active)
- Embedded Ghost Chat modal/overlay in DriverDashboard that opens when activeRide is not null (after driver accepts a ride)
- 💬 GHOST CHAT button in the in-ride section of RiderDashboard (alongside LIVE MAP, GHOST DÜELLO, HAFIZA BOMBASI buttons)
- 💬 GHOST CHAT button in the active ride section of DriverDashboard (in the navigation/controls area)
- The chat channel is automatically keyed to the rideId so driver and rider auto-connect without manual password entry
- Both sides auto-join the same room using rideId as the shared channel key (no password screen needed — silent auto-connect)
- Full Ghost Chat features available in-ride: real-time messaging, emoji, attachments (photo/document/location), auto-delete timer, AI emoji suggestions, send/receive messages
- Ghost Call button available within the in-ride chat overlay
- Chat overlay is a full-screen modal with cyberpunk styling matching existing UI

### Modify
- RiderDashboard: accept rideId prop (already exists as state) and pass to in-ride Ghost Chat
- DriverDashboard: use activeRide.rideId as the shared channel key

### Remove
- Nothing removed

## Implementation Plan
1. Create a new `InRideGhostChat` component (in `src/frontend/src/components/InRideGhostChat.tsx`) that:
   - Accepts props: `rideId: string`, `myId: string`, `role: "rider" | "driver"`, `onClose: () => void`
   - Auto-connects on mount using `rideId` as channel code (format: `ride-${rideId}`)
   - Reuses the same backend logic as GhostChatPage (createGroupChannel/joinGroupChannel/getGroupMessages/sendGroupMessage/listGroupMembers)
   - Shows full chat UI: message list, input, emoji panel, attach menu, auto-delete timer selector
   - Includes 📞 GHOST CALL button that opens GhostCallOverlay
   - Auto-join flow: rider creates channel (first to join ride), driver joins; both connect automatically without password UI
   - Shows connection status while connecting ("Sürücü bekleniyor..." / "Yolcuya bağlanıyor...")
   - Cyberpunk styling matching existing app
2. Add `showGhostChat` state + GHOST CHAT button in RiderDashboard in-ride section (rideStatus === "active" or "searching")
3. Add `showGhostChat` state + GHOST CHAT button in DriverDashboard active ride section
4. Render `<InRideGhostChat>` as fullscreen overlay when showGhostChat is true in both dashboards
5. Channel is cleaned up (leaveGroupChannel) when overlay closes or component unmounts
