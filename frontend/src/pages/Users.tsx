import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, KeyRound, Power, Search, Trash2, UserCog } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../lib/types';
import { useAuth } from '../lib/auth';
import { Avatar, Badge, Modal, ConfirmModal, useToast, Switch, EmptyState, Skeleton } from '../components/ui';
import { cx } from '../lib/utils';

const ROLES = ['user', 'admin', 'super_admin'];

export default function Users() {
  const toast = useToast();
  const { user: me, isSuper } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [depts, setDepts] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user', title: '', team_id: '', department_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t, d] = await Promise.all([
        api.get<User[]>('/users'), api.get<{ id: number; name: string }[]>('/teams'), api.get<{ id: number; name: string }[]>('/departments'),
      ]);
      setUsers(u); setTeams(t); setDepts(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (u?: User) => {
    setEditing(u || null);
    setForm(u ? {
      name: u.name, email: u.email, password: '', role: u.role, title: u.title || '',
      team_id: String(u.team_id || ''), department_id: String(u.department_id || ''),
    } : { name: '', email: '', password: '', role: 'user', title: '', team_id: '', department_id: '' });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.email) return toast('Name and email are required', 'error');
    if (!editing && !form.password) return toast('Password is required', 'error');
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, {
          name: form.name, role: form.role, title: form.title,
          team_id: form.team_id ? Number(form.team_id) : null,
          department_id: form.department_id ? Number(form.department_id) : null,
        });
        toast('User updated');
      } else {
        await api.post('/users', { ...form, team_id: form.team_id ? Number(form.team_id) : null, department_id: form.department_id ? Number(form.department_id) : null });
        toast('User created');
      }
      setFormOpen(false);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    const r = await api.post<{ temporaryPassword: string }>(`/users/${resetTarget.id}/reset-password`, {});
    toast(`Password reset to: ${r.temporaryPassword}`, 'info');
    load();
  };

  const toggleActive = async (u: User) => {
    await api.post(`/users/${u.id}/toggle-active`, {});
    toast(u.is_active ? 'User deactivated' : 'User activated');
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast('User deleted');
      setDeleteTarget(null);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const filtered = users.filter((u) => (u.name + u.email + (u.role || '')).toLowerCase().includes(q.toLowerCase()));
  const roleColor: Record<string, string> = { super_admin: '#8b5cf6', admin: '#6366f1', user: '#22c55e' };

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><UserCog size={24} className="text-brand" /> User Management</h1>
          <p className="text-sm text-ink2 mt-0.5">{users.length} users · RBAC enabled</p>
        </div>
        <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> New User</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
        <input className="input !pl-9" placeholder="Search users..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UserCog size={26} />} title="No users found" subtitle="Try a different search term." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <div key={u.id} className="card card-hover p-4 anim-in">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} src={u.avatar} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{u.name} {u.id === me?.id && <span className="text-xs text-brand">(you)</span>}</div>
                  <div className="text-xs text-ink3 truncate">{u.email}</div>
                </div>
                <Badge color={roleColor[u.role] || '#94a3b8'}>{u.role.replace('_', ' ')}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-ink2">
                <span className="chip">{u.team_name || 'No team'}</span>
                <span className="chip">{u.department_name || 'No dept'}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <button className="btn btn-ghost btn-xs" onClick={() => openForm(u)}><Pencil size={12} /> Edit</button>
                <button className="btn btn-ghost btn-xs" onClick={() => setResetTarget(u)}><KeyRound size={12} /> Reset</button>
                <button className={cx('btn btn-xs', u.is_active ? 'btn-danger' : 'btn-ghost')} onClick={() => toggleActive(u)} disabled={u.id === me?.id}>
                  <Power size={12} /> {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
                {isSuper && (
                  <button className="btn btn-ghost btn-xs !text-red-500" onClick={() => setDeleteTarget(u)} disabled={u.id === me?.id}>
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit User' : 'Create User'}
        footer={<><button className="btn btn-ghost" onClick={() => setFormOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <label className="label">{editing ? 'New Password' : 'Password *'}</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Leave blank to keep' : ''} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Team</label>
              <select className="input" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                <option value="">None</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">None</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!resetTarget} onClose={() => setResetTarget(null)} onConfirm={resetPassword}
        title="Reset password?" message={`Reset the password for ${resetTarget?.name}? A temporary password will be shown.`} confirmLabel="Reset" danger />

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete}
        title="Delete user?" message={`Permanently delete ${deleteTarget?.name}? This removes their comments, time entries, approvals and attachments, and unassigns them from tasks. This cannot be undone.`} confirmLabel="Delete" danger />
    </div>
  );
}
