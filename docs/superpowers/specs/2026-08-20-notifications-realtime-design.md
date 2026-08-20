# Notifications: Production-Ready Realtime Delivery

Date: 2026-08-20
Status: Approved (user: "go ahead" on design summary)

## Problem

The notification bell works but is not production-ready:

- No realtime delivery: the frontend polls `/api/notifications` every 20 seconds, so the badge and list are stale for up to 20s.
- Clicking a notification marks it read and calls `navigate(link)` but never closes the dropdown, leaving the panel open over the destination page. Notifications without a link (e.g., seeded/deadline ones) only mark read with no visible feedback.
- All notifications look identical; there is no per-type icon/color so it is hard to scan task/comment/approval/deadline events.

## Scope

- Fix click behavior (mark read + close dropdown + navigate; plain close+mark when no link).
- Auto-close dropdown on outside click, Escape, and after viewing.
- Realtime push via Server-Sent Events (SSE).
- Per-type icon and color for notifications (bell dropdown + Dashboard list).
- No dedicated Notifications page, no new notification triggers.

## Architecture

### Backend: `src/lib/notifier.js` (new)

Realtime hub.

- `clients`: `Map<userId, Set<response>>`.
- `subscribe(userId, res) -> unsubscribe()`.
- `broadcast(userId, event, data)`: writes `event: <event>\ndata: <json>\n\n` to every connected response.
- `unreadCount(userId)`: `COUNT(*)` of unread rows.
- `notify(userId, type, title, message, link='')`: inserts the notification row, then broadcasts `notification` event with `{ notification: row, unread }`.

### Backend: `src/middleware.js`

- `notify(...)` delegates to `lib/notifier.notify` (signature unchanged, all existing callers unaffected).
- Add `authUserFromToken(token)` helper (used by the SSE endpoint; reuses JWT secret + user lookup + active check).

### Backend: `src/routes/notifications.js`

- Add `GET /stream`:
  - Auth via `?token=` (EventSource cannot set headers) or `Authorization: Bearer`.
  - Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
  - Sends `retry: 3000`, an initial `connected` event `{ unread }`, heartbeat `: ping` every 25s, cleanup on `close`.
- Mark-read (`PUT /:id/read`), mark-all (`PUT /read-all`), delete (`DELETE /:id`) broadcast a `sync` event `{ unread }` so all open tabs stay consistent.

### Frontend: `src/lib/notifications.tsx` (new)

Type metadata map used for icons:

- task -> ListTodo / blue `#3b82f6`
- comment -> MessageSquare / indigo `#6366f1`
- approval -> ClipboardCheck / purple `#8b5cf6`
- deadline -> AlertTriangle / red `#ef4444`
- system -> Bell / slate `#64748b`
- security -> ShieldCheck / amber `#f59e0b`
- info (default) -> Info / cyan `#06b6d4`

Export `notifTypeMeta(type)`.

### Frontend: `src/lib/useNotifications.ts` (new)

React hook owning notification state + SSE.

- Opens `EventSource('/api/notifications/stream?token=...')` while authenticated.
- Handles events:
  - `notification`: prepend `{ notification, unread }` (dedupe by id, cap 50), update badge.
  - `connected`: set `unread`, mark `live=true`.
  - `sync`: refetch the list.
  - `error`: `live=false` (EventSource auto-reconnects; polling fallback keeps data fresh).
- Polls every 20s as a fallback but skips when `live=true`.
- `refresh()`, `markOne(id)`, `markAll()` update local state immediately after the API call.

### Frontend: `src/components/Layout.tsx`

- Replace local notification state with `useNotifications()`.
- Item click handler: if unread, `markOne(id)`; close dropdown; `navigate(link)` when present.
- Close dropdown on outside click (document mousedown via ref) and Escape.
- Refresh list when opening the bell.
- Render each item with `notifTypeMeta(n.type)` icon + color; keep unread dot, title/message, `timeAgo`.
- Keep the unread badge on the bell.

### Frontend: `src/pages/Dashboard.tsx`

- Replace the plain dot in "My Recent Notifications" with the per-type icon/color from `notifTypeMeta`.

## Data flow

1. Event occurs (assignment, comment, approval, admin action) -> `notify()` -> DB insert -> `broadcast('notification', ...)`.
2. EventSource delivers to all of the user's open tabs -> hook prepends + bumps badge.
3. User marks read / mark-all -> `PUT` -> `broadcast('sync')` -> other tabs refetch.
4. If SSE drops, EventSource reconnects; 20s polling (only when not live) is the safety net.

## Testing

- Backend (curl): start an SSE stream with the token, assign a task, assert a `notification` event arrives with the task payload and correct `unread`.
- Backend (curl): mark-read in one session, assert the `sync` event in the other.
- Frontend: `npm run build` passes.
- Manual: preview URL, log in, trigger assignment from a second account, verify badge updates instantly, click notification navigates and closes dropdown; verify icons/colors.

## Out of scope

- Dedicated Notifications history page.
- New triggers (mentions, status-change alerts, runtime deadline reminders).
- Per-notification delete/hover mark-read in the dropdown UI.
