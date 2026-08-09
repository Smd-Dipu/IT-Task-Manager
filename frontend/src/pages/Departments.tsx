import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Department, User } from '../lib/types';
import { Modal, ConfirmModal, useToast, EmptyState, Skeleton } from '../components/ui';

export default function Departments() {
  const toast = useToast();
  const [depts, setDepts] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [delTarget, setDelTarget] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '', head_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, u] = await Promise.all([api.get<Department[]>('/departments'), api.get<User[]>('/users')]);
      setDepts(d); setUsers(u);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openForm = (d?: Department) => {
    setEditing(d || null);
    setForm(d ? { name: d.name, description: d.description || '', head_id: String(d.head_id || '') } : { name: '', description: '', head_id: '' });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast('Name is required', 'error');
    try {
      const payload = { ...form, head_id: form.head_id ? Number(form.head_id) : null };
      if (editing) { await api.put(`/departments/${editing.id}`, payload); toast('Department updated'); }
      else { await api.post('/departments', payload); toast('Department created'); }
      setFormOpen(false); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><Building2 size={24} className="text-brand" /> Departments</h1>
          <p className="text-sm text-ink2 mt-0.5">{depts.length} departments</p>
        </div>
        <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> New Department</button>
      </div>

      {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div> :
      depts.length === 0 ? <EmptyState icon={<Building2 size={26} />} title="No departments" subtitle="Create your first department." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map((d) => (
            <div key={d.id} className="card card-hover p-4 anim-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">{d.name}</h3>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-card2 text-ink2" onClick={() => openForm(d)}><Pencil size={14} /></button>
                  <button className="p-1.5 rounded-lg hover:bg-bad/10 text-ink2 hover:text-bad" onClick={() => setDelTarget(d)}><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-ink2 line-clamp-2 min-h-[2rem]">{d.description || 'No description'}</p>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="chip">{d.member_count} members</span>
                <span className="chip">{d.done_count}/{d.task_count} tasks done</span>
                {d.head_name && <span className="chip">Head: {d.head_name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Department' : 'Create Department'}
        footer={<><button className="btn btn-ghost" onClick={() => setFormOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Department Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Department Head</label>
            <select className="input" value={form.head_id} onChange={(e) => setForm({ ...form, head_id: e.target.value })}>
              <option value="">None</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={async () => { await api.delete(`/departments/${delTarget!.id}`); toast('Department deleted'); load(); }}
        title="Delete department?" message={`Delete "${delTarget?.name}"? Users will be unassigned.`} confirmLabel="Delete" danger />
    </div>
  );
}
