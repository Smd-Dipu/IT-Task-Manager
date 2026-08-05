import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Paperclip, MessageSquare, GripVertical } from 'lucide-react';
import type { Task } from '../../lib/types';
import { useSettings } from '../../lib/settings';
import { statusById, priorityById, fmtDate, isOverdue, cx } from '../../lib/utils';
import { Avatar, Badge } from '../ui';
import { api } from '../../lib/api';
import { useToast } from '../ui';

export function KanbanView({ tasks, onMoved }: { tasks: Task[]; onMoved?: () => void }) {
  const settings = useSettings();
  const navigate = useNavigate();
  const toast = useToast();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const statuses = settings?.taskStatuses || [];
  const cols = statuses.map((s) => ({ ...s, tasks: tasks.filter((t) => t.status === s.id) }));

  const onDrop = async (targetStatus: string) => {
    if (dragId == null) return;
    const t = tasks.find((x) => x.id === dragId);
    if (t && t.status !== targetStatus) {
      try {
        await api.post(`/tasks/${dragId}/status`, { status: targetStatus });
        toast(`Moved to ${statuses.find((s) => s.id === targetStatus)?.name || targetStatus}`);
        onMoved?.();
      } catch (e: any) {
        toast(e.message, 'error');
      }
    }
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 items-start">
      {cols.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
          onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
          onDrop={(e) => { e.preventDefault(); onDrop(col.id); }}
          className={cx(
            'w-[280px] shrink-0 rounded-2xl p-2.5 transition-all border border-line min-h-[200px]',
            overCol === col.id ? 'bg-brand/5 border-brand/40' : 'bg-card2/60',
          )}
        >
          <div className="flex items-center gap-2 px-1.5 pb-2.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
            <span className="font-semibold text-sm flex-1">{col.name}</span>
            <span className="text-xs text-ink3 font-bold">{col.tasks.length}</span>
          </div>
          <div className="space-y-2">
            {col.tasks.map((t) => {
              const pr = priorityById(settings, t.priority);
              const overdue = isOverdue(t);
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="card card-hover p-3 cursor-grab active:cursor-grabbing anim-in"
                >
                  <div className="flex items-start gap-1.5 mb-1.5">
                    <GripVertical size={14} className="text-ink3 shrink-0 mt-0.5" />
                    <h5 className="font-semibold text-sm leading-snug">{t.title}</h5>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {t.flags?.slice(0, 2).map((f) => <Badge key={f} color="#f59e0b">{f}</Badge>)}
                    <Badge color={pr.color}>{pr.name}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex -space-x-1.5">
                      {(t.assignees || []).slice(0, 3).map((a) => <span key={a.user_id}><Avatar name={a.user_name} src={a.avatar} size={22} /></span>)}
                    </div>
                    <div className="flex items-center gap-2 text-ink3 text-[11px]">
                      {t.due_date && <span className={cx('flex items-center gap-1', overdue && 'text-bad font-semibold')}><CalendarDays size={11} />{fmtDate(t.due_date)}</span>}
                      {t.comments_count ? <span className="flex items-center gap-0.5"><MessageSquare size={11} />{t.comments_count}</span> : null}
                      {t.attachments_count ? <span className="flex items-center gap-0.5"><Paperclip size={11} />{t.attachments_count}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {col.tasks.length === 0 && (
              <div className="border-2 border-dashed border-line rounded-xl py-8 text-center text-xs text-ink3">
                Drop tasks here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
