# Priority Task: Transfer to Main Tasks Table

Date: 2026-08-20
Status: Approved (user: "yes" on design summary)

## Problem

Priority tasks are a separate Excel-fed list. The user wants a way to back them up into the main Tasks table so they are preserved as real tasks.

## Decisions (user-confirmed)

- Per-row **Transfer button** (no checkbox/multi-select).
- **Admins only** can transfer.
- **Full copy** of the priority task into a real task, with a `Priority Task` tag plus a stored source reference.

## Behavior

- `POST /api/priority-tasks/:id/transfer` (admin only):
  - 404 if the priority task does not exist.
  - 400 "already transferred" if `transferred_at` is already set (prevents duplicate backups).
  - Creates a task in the main Tasks table:
    - `title` = `work_title`
    - `description` = priority task description, with `\nRemarks: <remarks>` appended when remarks exist
    - `priority` = priority task priority
    - `status` = priority task status
    - `difficulty` = `medium`, `task_type` = `task`
    - `due_date` = priority task due date (or null)
    - `tags` = `["Priority Task", "src:priority-task:<id>"]`
    - `created_by` = transferring admin
    - assignees = `[assignee_user_id]` when matched (inserted into `task_assignees` with the transferred status)
  - Marks the priority task `transferred_at` (UTC+6 now) and `transferred_task_id`.
  - Audits `priority_task.transfer`.
  - Does **not** fire an assignment notification (backup copy, avoids noise).

## Schema

`priority_tasks` gains:
- `transferred_at TEXT DEFAULT ''`
- `transferred_task_id INTEGER DEFAULT NULL`

Applied via guarded `ALTER TABLE` (PRAGMA `table_info` check) for existing databases and included in the `CREATE TABLE IF NOT EXISTS` for fresh installs.

## Frontend

- `PriorityTasks.tsx`:
  - Admin rows with `transferred_at` empty get a Transfer button (copy/forward icon) beside edit/delete.
  - Click opens a ConfirmModal ("Transfer '<work_title>' to Tasks? A copy will be created in the main task list as a backup.").
  - On confirm: `POST /priority-tasks/:id/transfer` -> toast -> reload.
  - Transferred items show a "Transferred" badge with a link to `/tasks/<transferred_task_id>`; the transfer button is hidden.
- `types.ts`: add `transferred_at?: string` and `transferred_task_id?: number | null` to `PriorityTask`.

## Testing

- Admin transfer creates a task visible in `/api/tasks` with correct title/description/priority/status/due date, `Priority Task` + source tags, and the matched assignee.
- Second transfer of the same item returns 400.
- Non-admin transfer returns 403.
- `npm run build` passes.
