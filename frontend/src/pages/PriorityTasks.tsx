import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListTodo, Upload, Download, Search, Plus, Pencil, Trash2, FileSpreadsheet, Filter, Users, ArrowRightToLine, ExternalLink,
} from 'lucide-react';
import { api, downloadExport } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast, Modal, Badge, Avatar, EmptyState, Skeleton, ConfirmModal, Switch } from '../components/ui';
import { useSettings } from '../lib/settings';
import { cx, fmtDate } from '../lib/utils';
import type { PriorityTask, UploadResult } from '../lib/types';

const EMPTY_FORM = {
  work_title: '', description: '', priority: 'medium', assignee_name: '', status: 'todo', due_date: '', remarks: '',
};

export default function PriorityTasks() {
  const { isAdmin } = useAuth();
  const settings = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<PriorityTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PriorityTask | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PriorityTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<PriorityTask[]>('/priority-tasks', { search: search || undefined, priority: priority || undefined, status: status || undefined });
      setItems(d);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [search, priority, status, toast]);

  useEffect(() => { load(); }, [load]);

  const statuses = settings?.taskStatuses || [];
  const priorities = settings?.priorities || [];

  const changeStatus = async (item: PriorityTask, value: string) => {
    const prev = items;
    setItems((its) => its.map((x) => (x.id === item.id ? { ...x, status: value, status_meta: statuses.find((s) => s.id === value) || x.status_meta } : x)));
    try {
      await api.put(`/priority-tasks/${item.id}`, { status: value });
      toast('Status updated');
    } catch (e: any) {
      setItems(prev);
      toast(e.message, 'error');
    }
  };

  const openUpload = () => {
    setFile(null);
    setReplaceMode(false);
    setUploadResult(null);
    setUploadOpen(true);
  };

  const doUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', replaceMode ? 'replace' : 'append');
      const r = await api.upload<UploadResult>('/priority-tasks/upload', fd);
      setUploadResult(r);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
      toast(`Imported ${r.imported} priority task(s)`);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setUploading(false); }
  };

  const openEdit = (item?: PriorityTask | null) => {
    setEditing(item || null);
    setForm(item ? {
      work_title: item.work_title,
      description: item.description || '',
      priority: item.priority,
      assignee_name: item.assignee_name || '',
      status: item.status,
      due_date: item.due_date || '',
      remarks: item.remarks || '',
    } : EMPTY_FORM);
    setEditOpen(true);
  };

  const saveItem = async () => {
    if (!form.work_title.trim()) { toast('Work Title is required', 'warning'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/priority-tasks/${editing.id}`, form);
        toast('Priority task updated');
      } else {
        await api.post('/priority-tasks', form);
        toast('Priority task created');
      }
      setEditOpen(false);
      await load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/priority-tasks/${deleteTarget.id}`);
      toast('Priority task deleted');
      setDeleteTarget(null);
      await load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setDeleting(false); }
  };

  const [transferTarget, setTransferTarget] = useState<PriorityTask | null>(null);
  const [transferring, setTransferring] = useState(false);

  const doTransfer = async () => {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      const r = await api.post<PriorityTask>(`/priority-tasks/${transferTarget.id}/transfer`);
      toast(`Transferred to task #${r.transferred_task_id}`);
      setTransferTarget(null);
      await load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setTransferring(false); }
  };

  const downloadTemplate = async () => {
    try { await downloadExport('/priority-tasks/template', 'priority-task-template.xlsx'); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const stats = useMemo(() => {
    const c = (s: string) => items.filter((i) => i.status === s).length;
    return { total: items.length, done: c('done'), active: items.length - c('done') - c('cancelled') };
  }, [items]);

  const formField = (label: string, key: keyof typeof EMPTY_FORM, input: React.ReactNode) => (
    <label className="block">
      <span className="text-xs font-semibold text-ink2">{label}</span>
      {input}
    </label>
  );

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><ListTodo size={24} className="text-brand" /> Priority Task</h1>
          <p className="text-sm text-ink2 mt-0.5">
            {isAdmin ? 'Upload, manage and track the organization priority list' : 'View the organization priority list and update status'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} title="Download Excel template">
              <Download size={14} /> <span className="hidden sm:inline">Template</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(null)} title="Add priority task">
              <Plus size={14} /> <span className="hidden sm:inline">Add</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={openUpload} title="Upload Excel / CSV">
              <Upload size={14} /> <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md">
        <div className="card p-3 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-ink2">Total</div></div>
        <div className="card p-3 text-center"><div className="text-2xl font-bold text-warn">{stats.active}</div><div className="text-xs text-ink2">Active</div></div>
        <div className="card p-3 text-center"><div className="text-2xl font-bold text-ok">{stats.done}</div><div className="text-xs text-ink2">Done</div></div>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search work title, description, assignee..." className="input !pl-9 !py-2" />
        </div>
        <select className="input !w-auto !py-2" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input !w-auto !py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(search || priority || status) && (
          <button className="text-xs text-ink2 hover:text-ink flex items-center gap-1 px-2 py-1.5" onClick={() => { setSearch(''); setPriority(''); setStatus(''); }}>
            <Filter size={12} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ListTodo size={26} />}
            title="No priority tasks"
            subtitle={isAdmin
              ? 'Upload an Excel/CSV file to populate the priority list, or add a task manually.'
              : 'The priority list has not been populated yet. Check back later.'}
            action={isAdmin ? <button className="btn btn-primary" onClick={openUpload}><Upload size={14} /> Upload Excel</button> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const pm = item.priority_meta;
            const sm = item.status_meta;
            const overdue = !!item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && item.status !== 'done' && item.status !== 'cancelled';
            return (
              <div key={item.id} className="card p-4 flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('w-2 h-2 rounded-full shrink-0', pm ? '' : 'bg-line')} style={pm ? { background: pm.color } : undefined} />
                    <span className="font-semibold text-sm text-ink break-words">{item.work_title}</span>
                    {pm && <Badge color={pm.color}>{pm.name}</Badge>}
                    {sm && <Badge color={sm.color} dot>{sm.name}</Badge>}
                    {overdue && <Badge color="#ef4444">Overdue</Badge>}
                    {item.transferred_at && (
                      <button
                        onClick={() => item.transferred_task_id && navigate(`/tasks/${item.transferred_task_id}`)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ color: '#22c55e', background: '#22c55e1a', border: '1px solid #22c55e33' }}
                        title="Opened in Tasks"
                      >
                        <ExternalLink size={10} /> Transferred{item.transferred_task_id ? ` #${item.transferred_task_id}` : ''}
                      </button>
                    )}
                  </div>
                  {item.description && <p className="text-sm text-ink2 mt-1 break-words">{item.description}</p>}
                  {item.remarks && <p className="text-xs text-ink3 mt-1 break-words">Note: {item.remarks}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-ink3">
                    <span className="flex items-center gap-1.5">
                      {item.assignee_user_id ? <Avatar name={item.assignee_name} src={item.assignee_avatar} size={20} /> : <Users size={14} />}
                      {item.assignee_name || 'Unassigned'}
                    </span>
                    {item.due_date && <span>Due {fmtDate(item.due_date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="input !w-auto !py-1.5 text-sm"
                    value={item.status}
                    onChange={(e) => changeStatus(item, e.target.value)}
                    title="Update status"
                  >
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {isAdmin && (
                    <>
                      {!item.transferred_at && (
                        <button className="p-2 rounded-lg hover:bg-card2 text-ink2 hover:text-ok" title="Transfer to Tasks" onClick={() => setTransferTarget(item)}>
                          <ArrowRightToLine size={15} />
                        </button>
                      )}
                      <button className="p-2 rounded-lg hover:bg-card2 text-ink2 hover:text-brand" title="Edit" onClick={() => openEdit(item)}><Pencil size={15} /></button>
                      <button className="p-2 rounded-lg hover:bg-card2 text-ink2 hover:text-bad" title="Delete" onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={uploadOpen} onClose={() => { if (!uploading) setUploadOpen(false); }} title="Upload Priority Task File" width={520}>
        {uploadResult ? (
          <div className="space-y-3">
            <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(34,197,94,0.08)' }}>
              <div className="font-semibold text-ok">Import complete</div>
              <div className="mt-1 text-ink2">
                {uploadResult.imported} imported · {uploadResult.skipped} skipped ({uploadResult.mode === 'replace' ? 'replaced existing list' : 'appended'})
              </div>
            </div>
            {uploadResult.errors.length > 0 && (
              <div className="rounded-xl p-3 bg-card2/70 max-h-48 overflow-y-auto text-xs space-y-1">
                {uploadResult.errors.map((e, i) => (
                  <div key={i} className="text-ink2">Row {e.row}: <span className="text-bad">{e.message}</span></div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-primary" onClick={() => { setUploadResult(null); setUploadOpen(false); }}>Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-line p-6 text-center">
              <FileSpreadsheet size={28} className="text-ink3 mx-auto mb-2" />
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block mx-auto text-sm text-ink2 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-brand file:text-white file:text-sm file:font-medium"
              />
              {file && <div className="text-xs text-ink3 mt-2">{file.name}</div>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink2">Replace existing list</span>
              <Switch checked={replaceMode} onChange={setReplaceMode} />
            </div>
            <p className="text-xs text-ink3">
              {replaceMode
                ? 'The current priority list will be cleared and replaced with the file contents.'
                : 'New rows are appended. Rows with a duplicate work title are skipped.'}
              {isAdmin ? '' : ''}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-ghost" disabled={uploading} onClick={() => setUploadOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!file || uploading} onClick={doUpload}>
                {uploading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editing ? 'Edit Priority Task' : 'Add Priority Task'} width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formField('Work Title *', 'work_title', (
            <input className="input" value={form.work_title} onChange={(e) => setForm({ ...form, work_title: e.target.value })} placeholder="e.g. Release checklist" />
          ))}
          {formField('Priority', 'priority', (
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ))}
          {formField('Assignee', 'assignee_name', (
            <input className="input" value={form.assignee_name} onChange={(e) => setForm({ ...form, assignee_name: e.target.value })} placeholder="User name or email" />
          ))}
          {formField('Status', 'status', (
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ))}
          {formField('Due Date', 'due_date', (
            <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          ))}
          {formField('Remarks', 'remarks', (
            <input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional note" />
          ))}
          <div className="md:col-span-2">
            {formField('Description', 'description', (
              <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Delete priority task?"
        message={`"${deleteTarget?.work_title}" will be permanently removed.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
      />

      <ConfirmModal
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        onConfirm={doTransfer}
        title="Transfer to Tasks?"
        message={`"${transferTarget?.work_title}" will be copied into the main task list as a backup, tagged as a Priority Task.`}
        confirmLabel={transferring ? 'Transferring...' : 'Transfer'}
      />
    </div>
  );
}
