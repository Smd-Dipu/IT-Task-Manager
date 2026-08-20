export type Role = 'super_admin' | 'admin' | 'user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  title?: string;
  phone?: string;
  avatar?: string;
  team_id?: number | null;
  department_id?: number | null;
  team_name?: string;
  department_name?: string;
  is_active?: boolean;
  last_login?: string;
  created_at?: string;
  initials?: string;
  open_tasks?: number;
  completed_tasks?: number;
  tasks_created?: number;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  lead_id?: number | null;
  lead_name?: string;
  member_count?: number;
  task_count?: number;
  done_count?: number;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  head_id?: number | null;
  head_name?: string;
  member_count?: number;
  task_count?: number;
  done_count?: number;
}

export interface Assignee {
  id: number;
  task_id: number;
  user_id: number;
  progress: number;
  status: string;
  assigned_at: string;
  completed_at?: string | null;
  user_name: string;
  avatar?: string;
  team_id?: number | null;
}

export interface StatusMeta { id: string; name: string; color: string; icon?: string; }
export interface PriorityMeta { id: string; name: string; color: string; weight: number; }
export interface DifficultyMeta { id: string; name: string; points: number; }

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  difficulty: string;
  task_type: string;
  flags: string[];
  tags: string[];
  budget?: number;
  estimated_hours?: number;
  due_date?: string | null;
  start_date?: string | null;
  created_by: number;
  reviewer_id?: number | null;
  team_id?: number | null;
  department_id?: number | null;
  parent_task_id?: number | null;
  progress: number;
  approval_status: string;
  is_blocked: boolean;
  is_recurring: boolean;
  recurring_rule?: string;
  archived: boolean;
  is_self_task?: number | boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  created_by_name?: string;
  reviewer_name?: string;
  team_name?: string;
  department_name?: string;
  assigned_names?: string;
  assignees?: Assignee[];
  comments_count?: number;
  attachments_count?: number;
  checklist?: { total: number; done: number };
  status_meta?: StatusMeta;
  priority_meta?: PriorityMeta;
  difficulty_meta?: DifficultyMeta;
}

export interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  mentions: number[];
  created_at: string;
  user_name?: string;
  avatar?: string;
}

export interface PriorityTask {
  id: number;
  work_title: string;
  description?: string;
  priority: string;
  assignee_name?: string;
  assignee_user_id?: number | null;
  assignee_avatar?: string;
  status: string;
  due_date?: string | null;
  remarks?: string;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  priority_meta?: PriorityMeta;
  status_meta?: StatusMeta;
}

export interface UploadResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  mode: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  details: string;
  ip?: string;
  created_at: string;
}

export interface KpiEntry {
  userId: number;
  name: string;
  role: string;
  avatar?: string;
  team_name?: string;
  department_name?: string;
  completed: number;
  selfCompleted: number;
  totalAssigned: number;
  totalDone: number;
  completionRate: number;
  onTime: number;
  late: number;
  overdueCount: number;
  avgCompletionHours: number;
  points: number;
  bonus: number;
  penalty: number;
  productivity: number;
  rating: number;
  score: number;
}

export interface Settings {
  taskStatuses: StatusMeta[];
  priorities: PriorityMeta[];
  difficulties: DifficultyMeta[];
  kpi: {
    enabled: boolean;
    completedTaskPoints: number;
    onTimeBonus: number;
    overduePenalty: number;
    difficultyBonus: boolean;
    reviewScoreWeight: number;
    productivityWeight: number;
    targetCompletionRate: number;
  };
  workingDays: number[];
  businessHours: { start: string; end: string };
  notificationRules: Record<string, boolean | number>;
  security: { twoFactorEnabled: boolean; sessionTimeoutMinutes: number };
  dashboard: Record<string, unknown>;
}

export interface TaskHistory {
  id: number;
  task_id: number;
  user_id?: number;
  action: string;
  field: string;
  old_value: string;
  new_value: string;
  created_at: string;
  user_name?: string;
}

export interface ChecklistItem {
  id: number;
  task_id: number;
  title: string;
  done: number;
  created_by?: number;
  created_at: string;
}

export interface Attachment {
  id: number;
  task_id: number;
  user_id: number;
  filename: string;
  stored_name: string;
  size: number;
  mime?: string;
  uploaded_at: string;
}

export interface Approval {
  id: number;
  task_id: number;
  requester_id: number;
  approver_id?: number;
  status: string;
  comment?: string;
  created_at: string;
  updated_at?: string;
  requester_name?: string;
  approver_name?: string;
}

export interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  hours: number;
  note?: string;
  date: string;
  created_at: string;
  user_name?: string;
}

export interface TaskDetail extends Task {
  comments: Comment[];
  checklist_items: ChecklistItem[];
  attachments: Attachment[];
  history: TaskHistory[];
  dependencies: { depends_on: number; title: string; status: string }[];
  dependents: { task_id: number; title: string }[];
  approvals: Approval[];
  time_entries: TimeEntry[];
}

export interface DashboardData {
  summary: {
    total: number; open: number; done: number; cancelled: number; overdue: number;
    pending: number; inProgress: number; inReview: number; dueToday: number; dueWeek: number;
    blocked: number; critical: number; doneToday: number; activeUsers: number;
    completionRate: number; avgCompletionHours: number;
    budgetUtil: { budget: number; hours: number };
  };
  daily: { day: string; date: string; added: number; done: number }[];
  monthly: { day: string; date: string; added: number; done: number }[];
  completionTrend: { day: string; date: string; completed: number }[];
  overdueTrend: { day: string; date: string; overdue: number }[];
  teamPerf: { id: number; name: string; total: number; done: number }[];
  deptPerf: { id: number; name: string; total: number; done: number }[];
  userPerf: { id: number; name: string; avatar?: string; assigned: number; done: number }[];
  statusDist: { status: string; name: string; color: string; count: number }[];
  prioDist: { priority: string; name: string; color: string; count: number }[];
  recentTasks: Task[];
  activities: { id: number; action: string; field: string; old_value: string; new_value: string; user_name?: string; created_at: string }[];
  notifications: Notification[];
  kpi: KpiEntry[];
  calendar: { id: number; title: string; due_date: string; status: string; priority: string }[];
}
