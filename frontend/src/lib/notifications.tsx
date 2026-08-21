import {
  ListTodo, MessageSquare, ClipboardCheck, AlertTriangle, Bell, ShieldCheck, Info,
  type LucideIcon,
} from 'lucide-react';

export interface NotifTypeMeta { icon: LucideIcon; color: string; label: string; }

export const NOTIF_TYPE_META: Record<string, NotifTypeMeta> = {
  task: { icon: ListTodo, color: '#3b82f6', label: 'Task' },
  comment: { icon: MessageSquare, color: '#6366f1', label: 'Comment' },
  approval: { icon: ClipboardCheck, color: '#8b5cf6', label: 'Approval' },
  deadline: { icon: AlertTriangle, color: '#ef4444', label: 'Deadline' },
  system: { icon: Bell, color: '#64748b', label: 'System' },
  security: { icon: ShieldCheck, color: '#f59e0b', label: 'Security' },
  info: { icon: Info, color: '#06b6d4', label: 'Info' },
};

export function notifTypeMeta(type?: string): NotifTypeMeta {
  return NOTIF_TYPE_META[type || 'info'] || NOTIF_TYPE_META.info;
}
