# TaskFlow — Enterprise Task Management System

A modern, enterprise-grade Task Management System with Role-Based Access Control (RBAC),
separate Admin and User dashboards, KPI-driven performance management, and a premium
glassmorphism UI with full dark/light theming.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + Recharts + Lucide icons
- **Backend**: Node.js (Express) + built-in `node:sqlite` (no external DB needed)
- **Auth**: JWT (bcrypt-hashed passwords), role-based access control
- **Exports**: CSV, Excel (.xlsx via ExcelJS), PDF (via PDFKit)

## Quick Start

```bash
# Install dependencies
npm run install:all

# Run both services (backend :3001, frontend :5173)
npm run dev

# Or production mode (builds frontend, backend serves it)
npm start
```

The frontend dev server (`:5173`) proxies `/api` to the backend (`:3001`), so only one
port is exposed in preview environments.

## Demo Accounts (all passwords: `password123`)

| Role | Email |
|------|-------|
| Super Admin | admin@taskflow.io |
| Admin | sarah@taskflow.io |
| User | emily@taskflow.io |

## Features

### Roles & Permissions
- **Super Admin** — full system access, users, teams, departments, KPI, settings, audit
- **Admin** — manages users/teams/departments, tasks, KPI, reports, exports
- **User** — assigned tasks, progress, comments, attachments, notifications, personal dashboard

### Dashboards
- **Executive Dashboard** (admin): summary cards (total/open/completion rate/done-per-day/overdue/pending/avg completion), charts (daily added vs completed, status & priority distribution, team/department performance, monthly productivity, user ranking, KPI scores, completion & overdue trends), recent activity feed
- **User Dashboard**: my tasks, today's tasks, overdue, completed, pending approval, avg completion time, personal KPI score, calendar, notifications, personal charts

### Task Management
- Full task form: status, priority, difficulty, type, flags, tags, budget, hours, due date, team, department, reviewer, dependencies, checklist, recurrence, blocked flag
- **Multiple assignees** with individual progress tracking
- **Views**: List, Grid, Kanban (drag & drop), Calendar, Timeline
- Comments with @mentions, file attachments, checklist/subtasks, time tracking, approval workflow, task history
- **Advanced filters**: date presets + custom range, status/priority/difficulty/type/tags/flags, assignee/creator/reviewer/team/department, quick toggles, saved filter presets, sorting, export

### KPI Management (Admin)
- Difficulty-weighted scoring (Easy 1 / Medium 2 / Hard 3 / Critical 5 pts)
- `Performance = Completed Points + On-Time Bonus - Overdue Penalty + Rating`
- Top/lowest performers, team & department ranking, monthly/yearly KPI, performance trend
- Users see only their own KPI summary

### Administration
- User management (create/edit, role assignment, reset passwords, activate/deactivate)
- Team & department management
- Settings: task statuses (color-coded), priorities, KPI formula, working days, business hours, holidays, notification rules, security (2FA toggle)
- Audit logs, saved filters, exports (CSV/XLSX/PDF)

### UX
- Premium glassmorphism cards, gradient accents, smooth animations, fully responsive
- Dark/Light mode with persisted preference
- Global search, notification center, quick actions, color-coded statuses

## Project Structure

```
backend/src/
  index.js        Express entry (serves frontend dist in production)
  db.js           SQLite schema
  seed.js         Demo data (users, teams, departments, tasks)
  config.js       Default settings (statuses, priorities, KPI)
  middleware.js   JWT auth, RBAC, audit logging, notifications
  routes/         auth, users, teams, departments, tasks, settings,
                  kpi, dashboard, reports/export, notifications, audit, uploads
frontend/src/
  lib/            api client, auth, theme, settings, types, utils, filters
  components/     ui kit, layout, charts, filters, task views, task form
  pages/          login, dashboard, tasks, task detail, users, teams,
                  departments, kpi, reports, settings, audit, profile
```
