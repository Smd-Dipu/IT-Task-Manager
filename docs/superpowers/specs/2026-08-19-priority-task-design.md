# Priority Task — Excel-Uploaded Priority Work List

Date: 2026-08-19
Status: Approved by user (verbal)

## Overview

Add a new "Priority Task" menu under the Task group in the sidebar. It maintains a
**lightweight, standalone priority work list** that is fed by Excel uploads. Items in
this list are separate from the main Tasks system — they never appear in `/tasks`,
reports, filters, or KPI.

All logged-in users can view the list and update an item's status (tracking). Only
admins can upload Excel files, download the template, and create/edit/delete items.

## Data model

New table `priority_tasks` (added via `CREATE TABLE IF NOT EXISTS` in `db.js`; no
schema version bump required):

| column | type | notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `work_title` | TEXT NOT NULL | required |
| `description` | TEXT DEFAULT '' | |
| `priority` | TEXT NOT NULL DEFAULT 'medium' | low/medium/high/critical |
| `assignee_name` | TEXT DEFAULT '' | display name |
| `assignee_user_id` | INTEGER NULL REFERENCES users(id) | set when name matches |
| `status` | TEXT NOT NULL DEFAULT 'todo' | existing statuses (todo…cancelled) |
| `due_date` | TEXT DEFAULT '' | YYYY-MM-DD |
| `remarks` | TEXT DEFAULT '' | |
| `created_by` | INTEGER REFERENCES users(id) | |
| `updated_by` | INTEGER REFERENCES users(id) | |
| `created_at` | TEXT DEFAULT (datetime('now','+6 hours')) | |
| `updated_at` | TEXT DEFAULT (datetime('now','+6 hours')) | |

Starts empty; populated by admin uploads.

## Backend API

New file `backend/src/routes/priorityTasks.js`, mounted at `/api/priority-tasks`.
Every route uses `requireAuth`.

| method | path | access | purpose |
|---|---|---|---|
| GET | `/` | all users | list; query filters `priority`, `status`, `search` |
| GET | `/template` | admin | download `.xlsx` template (7 columns + example row) |
| POST | `/upload` | admin | multer single file (`.xlsx`/`.csv`), `mode` = `append` (default) or `replace`; parse with ExcelJS; return `{ imported, skipped, errors:[{row, message}] }` |
| POST | `/` | admin | create a single item |
| PUT | `/:id` | admin: any field; user: `status` only | update |
| DELETE | `/:id` | admin | delete |

### Excel upload rules

- Headers (first row) matched case-insensitively: Work Title, Description, Priority,
  Assignee, Status, Due Date, Remarks.
- **Work Title** required — rows without it are skipped and reported.
- **Priority** mapped case-insensitively to low/medium/high/critical; also accepts the
  display names (Low/Medium/High/Critical). Unknown → row skipped + reported.
- **Status** mapped to existing status ids by name or id; unknown → defaults to `todo`.
- **Assignee** matched case-insensitively against `users.name` (and `users.email`
  fallback). Hit → `assignee_user_id` + `assignee_name`; miss → plain `assignee_name`.
- **Due Date** accepts `YYYY-MM-DD`, `MM/DD/YYYY`, or an Excel date serial; normalized
  to `YYYY-MM-DD`. Invalid → empty.
- `replace` mode wraps delete-all + insert in a transaction; on failure, rollback and
  return 400.
- Unsupported file type → 400. Rows are never partially fatal: invalid rows are skipped
  and reported in the result summary.
- Writes an audit log entry on upload/create/update/delete.

### Status update permission

- `PUT /:id` body `{ status }` is allowed for any authenticated user.
- `PUT /:id` body with any other field requires admin.

## Frontend

- New page `frontend/src/pages/PriorityTasks.tsx`.
- Route `/priority-tasks` in `App.tsx` inside the authenticated `Protected` layout
  (not admin-only).
- Sidebar nav item **"Priority Task"** added to the main Task group in `Layout.tsx`,
  directly below **Tasks**, with `ListTodo` icon.

### Page behavior

- Header: title + (admin) **Upload Excel** button and **Download Template** button.
- Upload modal (admin): file picker (`.xlsx`, `.csv`), **Append / Replace** toggle,
  submit; result toast + inline summary of imported/skipped/row errors.
- Filter row: search input, priority select, status select (reuse chip/input styles).
- Item list (card/row layout): priority badge, status badge, avatar when assignee is a
  matched user (else initials/plain name), due date, remarks.
- Admin: edit + delete actions per item (edit via a modal form).
- User: inline status dropdown on each item; saving persists immediately.
- Empty state prompting admin to upload.

## Error handling

- Upload returns per-row errors rather than failing the whole file.
- Unsupported files, invalid JSON, missing ids → 400/404 with JSON error messages.
- `replace` is transactional.

## Testing

- Generate a sample `.xlsx` with ExcelJS and exercise: append, replace, invalid rows
  (missing title / bad priority), assignee matching (matched + unknown), date parsing.
- Permission checks: user can only change status; admin full CRUD; template/download
  endpoints.
- Frontend: `tsc && vite build`.
