import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users as UsersIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { Team, User } from '../lib/types';
import { Modal, ConfirmModal, useToast, EmptyState, Skeleton } from '../components/ui';

export default function Teams() {
  const toast = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [delTarget, setDelTarget] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: '', description: '', lead_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([api.get<Team[]>('/teams'), api.get<User[]>('/users')]);
      setTeams(t); setUsers(u);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openForm = (t?: Team) => {
    setEditing(t || null);
    setForm(t ? { name: t.name, description: t.description || '', lead_id: String(t.lead_id || '') } : { name: '', description: '', lead_id: '' });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast('Name is required', 'error');
    try {
      const payload = { ...form, lead_id: form.lead_id ? Number(form.lead_id) : null };
      if (editing) { await api.put(`/teams/${editing.id}`, payload); toast('Team updated'); }
      else { await api.post('/teams', payload); toast('Team created'); }
      setFormOpen(false); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><UsersIcon size={24} className="text-brand" /> Teams</h1>
          <p className="text-sm text-ink2 mt-0.5">{teams.length} teams</p>
        </div>
        <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> New Team</button>
      </div>

      {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div> :
      teams.length === 0 ? <EmptyState icon={<UsersIcon size={26} />} title="No teams" subtitle="Create your first team." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <div key={t.id} className="card card-hover p-4 anim-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">{t.name}</h3>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-card2 text-ink2" onClick={() => openForm(t)}><Pencil size={14} /></button>
                  <button className="p-1.5 rounded-lg hover:bg-bad/10 text-ink2 hover:text-bad" onClick={() => setDelTarget(t)}><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-ink2 line-clamp-2 min-h-[2rem]">{t.description || 'No description'}</p>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="chip">{t.member_count} members</span>
                <span className="chip">{t.done_count}/{t.task_count} tasks done</span>
                {t.lead_name && <span className="chip">Lead: {t.lead_name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Team' : 'Create Team'}
        footer={<><button className="btn btn-ghost" onClick={() => setFormOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Team Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Team Lead</label>
            <select className="input" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
              <option value="">None</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={async () => { await api.delete(`/teams/${delTarget!.id}`); toast('Team deleted'); load(); }}
        title="Delete team?" message={`Delete "${delTarget?.name}"? Users will be unassigned.`} confirmLabel="Delete" danger />
    </div>
  );
}
