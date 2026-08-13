import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Plus, X, Save, CalendarDays, Bell, Shield, Gauge, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Settings } from '../lib/types';
import { useSetSettings } from '../lib/settings';
import { Switch, Modal, useToast, ConfirmModal, Badge } from '../components/ui';
import { cx } from '../lib/utils';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [holidays, setHolidays] = useState<{ id: number; date: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [prioModal, setPrioModal] = useState(false);
  const [kpiModal, setKpiModal] = useState(false);
  const [editStatus, setEditStatus] = useState<{ id: string; name: string; color: string } | null>(null);
  const [newStatus, setNewStatus] = useState<{ id: string; name: string; color: string }>({ id: '', name: '', color: '#6366f1' });
  const [delStatus, setDelStatus] = useState<{ id: string; name: string } | null>(null);
  const [editPrio, setEditPrio] = useState<{ id: string; name: string; color: string; weight: number } | null>(null);
  const [newPrio, setNewPrio] = useState<{ id: string; name: string; color: string; weight: number }>({ id: '', name: '', color: '#6366f1', weight: 3 });
  const [delPrio, setDelPrio] = useState<{ id: string; name: string } | null>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [delHoliday, setDelHoliday] = useState<string | null>(null);
  const setGlobalSettings = useSetSettings();
  const toast = useToast();

  useEffect(() => {
    api.get<Settings>('/settings').then(setSettings).catch(() => {});
    api.get<{ id: number; date: string; name: string }[]>('/settings/holidays').then(setHolidays).catch(() => {});
  }, []);

  if (!settings) return <div className="max-w-4xl mx-auto text-center py-20 text-ink2">Loading settings...</div>;

  const save = async (patch: Partial<Settings>): Promise<boolean> => {
    setSaving(true);
    try {
      await api.put('/settings', patch);
      const next = { ...settings, ...patch };
      setSettings(next);
      setGlobalSettings?.(next);
      toast('Settings saved');
      return true;
    } catch (e: any) { toast(e.message, 'error'); return false; }
    finally { setSaving(false); }
  };

  const saveStatus = async () => {
    if (!editStatus) return;
    const list = settings.taskStatuses.map((s) => s.id === editStatus.id ? { ...s, name: editStatus.name, color: editStatus.color } : s);
    if (await save({ taskStatuses: list })) setStatusModal(false);
  };
  const addStatus = async () => {
    if (!newStatus.name || !newStatus.id) return toast('Name and id required', 'error');
    const list = [...settings.taskStatuses, newStatus];
    if (await save({ taskStatuses: list })) setStatusModal(false);
  };
  const savePrio = async () => {
    if (!editPrio) return;
    const list = settings.priorities.map((p) => p.id === editPrio.id ? { ...p, name: editPrio.name, color: editPrio.color, weight: editPrio.weight } : p);
    if (await save({ priorities: list })) setPrioModal(false);
  };
  const addPrio = async () => {
    if (!newPrio.name || !newPrio.id) return toast('Name and id required', 'error');
    const list = [...settings.priorities, newPrio];
    if (await save({ priorities: list })) setPrioModal(false);
  };

  const deleteStatus = async () => {
    if (!delStatus) return;
    const list = settings.taskStatuses.filter((s) => s.id !== delStatus.id);
    if (await save({ taskStatuses: list })) setDelStatus(null);
  };
  const deletePrio = async () => {
    if (!delPrio) return;
    const list = settings.priorities.filter((p) => p.id !== delPrio.id);
    if (await save({ priorities: list })) setDelPrio(null);
  };

  const saveKpi = async () => {
    if (await save({ kpi: settings.kpi })) setKpiModal(false);
  };

  const addHoliday = async () => {
    if (!holidayDate) return;
    await api.post('/settings/holidays', { date: holidayDate, name: holidayName });
    setHolidayDate(''); setHolidayName('');
    api.get<{ id: number; date: string; name: string }[]>('/settings/holidays').then(setHolidays).catch(() => {});
    toast('Holiday added');
  };

  const weekday = (n: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][n];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><SettingsIcon size={24} className="text-brand" /> Settings</h1>
        <p className="text-sm text-ink2 mt-0.5">Customize statuses, priorities, KPI formula, working days and notifications</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Task Statuses</h3>
            <p className="text-xs text-ink3">Color-coded workflow states</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditStatus(null); setNewStatus({ id: '', name: '', color: '#6366f1' }); setStatusModal(true); }}><Plus size={14} /> Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.taskStatuses.map((s) => (
            <span key={s.id} className="chip !py-1 !pl-2 !pr-1 flex items-center gap-1" style={{ color: s.color, borderColor: s.color, background: `${s.color}14` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="mx-0.5">{s.name}</span>
              <button title="Edit status" onClick={() => { setEditStatus(s); setStatusModal(true); }} className="p-1 rounded hover:bg-black/5 transition-colors"><Pencil size={12} /></button>
              <button title="Delete status" onClick={() => setDelStatus(s)} className="p-1 rounded hover:bg-black/5 transition-colors text-bad"><Trash2 size={12} /></button>
            </span>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Priority Levels</h3>
            <p className="text-xs text-ink3">Used in filtering and KPI weighting</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditPrio(null); setNewPrio({ id: '', name: '', color: '#6366f1', weight: 3 }); setPrioModal(true); }}><Plus size={14} /> Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.priorities.map((p) => (
            <span key={p.id} className="chip !py-1 !pl-2 !pr-1 flex items-center gap-1" style={{ color: p.color, borderColor: p.color, background: `${p.color}14` }}>
              {p.name} <span className="opacity-60">(w{p.weight})</span>
              <button title="Edit priority" onClick={() => { setEditPrio({ id: p.id, name: p.name, color: p.color, weight: p.weight }); setPrioModal(true); }} className="p-1 rounded hover:bg-black/5 transition-colors"><Pencil size={12} /></button>
              <button title="Delete priority" onClick={() => setDelPrio(p)} className="p-1 rounded hover:bg-black/5 transition-colors text-bad"><Trash2 size={12} /></button>
            </span>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Gauge size={16} className="text-brand" /> KPI Formula</h3>
            <p className="text-xs text-ink3">Performance Score = Completed Points + On-Time Bonus - Overdue Penalty + Rating</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setKpiModal(true)}><Pencil size={13} /> Edit/Update</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            ['Task Points', settings.kpi.completedTaskPoints],
            ['On-Time Bonus', settings.kpi.onTimeBonus],
            ['Overdue Penalty', `-${settings.kpi.overduePenalty}`],
            ['Target Rate', `${settings.kpi.targetCompletionRate}%`],
            ['Difficulty Bonus', settings.kpi.difficultyBonus ? 'On' : 'Off'],
          ].map(([l, v]) => (
            <div key={l} className="p-3 rounded-xl bg-card2/70">
              <div className="font-extrabold text-lg text-brand">{v}</div>
              <div className="text-[11px] text-ink3">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-4"><CalendarDays size={16} className="text-brand" /> Working Days & Business Hours</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <button key={d}
              onClick={() => {
                const next = settings.workingDays.includes(d) ? settings.workingDays.filter((x) => x !== d) : [...settings.workingDays, d].sort();
                save({ workingDays: next });
              }}
              className={cx('chip !py-1.5 !px-3 cursor-pointer transition-all', settings.workingDays.includes(d) && '!bg-brand/15 !border-brand/40 !text-brand')}>
              {weekday(d)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="label !mb-0">Start:</label>
          <input type="time" className="input !w-auto" value={settings.businessHours.start}
            onChange={(e) => save({ businessHours: { ...settings.businessHours, start: e.target.value } })} />
          <label className="label !mb-0">End:</label>
          <input type="time" className="input !w-auto" value={settings.businessHours.end}
            onChange={(e) => save({ businessHours: { ...settings.businessHours, end: e.target.value } })} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-4"><CalendarDays size={16} className="text-brand" /> Holidays</h3>
        <div className="flex flex-wrap gap-2">
          <input type="date" className="input !w-auto" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          <input className="input !w-48" placeholder="Holiday name" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={addHoliday}><Plus size={14} /> Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {holidays.map((h) => (
            <span key={h.id} className="chip"><CalendarDays size={11} /> {h.date} {h.name} <button onClick={() => setDelHoliday(h.date)} className="text-ink3 hover:text-bad"><X size={11} /></button></span>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-4"><Bell size={16} className="text-brand" /> Notification Rules</h3>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="label !mb-0">Deadline approaching days:</label>
          <input type="number" min={1} className="input !w-24" value={Number(settings.notificationRules.deadlineApproachingDays)}
            onChange={(e) => save({ notificationRules: { ...settings.notificationRules, deadlineApproachingDays: Number(e.target.value) } })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(settings.notificationRules).filter(([k]) => k !== 'deadlineApproachingDays').map(([key, val]) => (
            <Switch key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              checked={!!val}
              onChange={(v) => save({ notificationRules: { ...settings.notificationRules, [key]: v } })} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-4"><Shield size={16} className="text-brand" /> Security</h3>
        <div className="space-y-3">
          <Switch label="Require Two-Factor Authentication (2FA)"
            checked={settings.security.twoFactorEnabled}
            onChange={(v) => save({ security: { ...settings.security, twoFactorEnabled: v } })} />
          <div>
            <label className="label">Session Timeout (minutes, 0 = no timeout)</label>
            <input type="number" className="input !w-40" value={settings.security.sessionTimeoutMinutes}
              onChange={(e) => save({ security: { ...settings.security, sessionTimeoutMinutes: Number(e.target.value) } })} />
          </div>
        </div>
      </div>

      <Modal open={statusModal} onClose={() => setStatusModal(false)} title={editStatus ? 'Edit Status' : 'Add Status'}
        footer={<><button className="btn btn-ghost" onClick={() => setStatusModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={editStatus ? saveStatus : addStatus}>{editStatus ? 'Save' : 'Add'}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">ID</label>
            <input className="input" value={editStatus?.id || newStatus.id} disabled={!!editStatus} onChange={(e) => setNewStatus({ ...newStatus, id: e.target.value.toLowerCase().replace(/ /g, '_') })} />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={editStatus?.name || newStatus.name} onChange={(e) => editStatus ? setEditStatus({ ...editStatus, name: e.target.value }) : setNewStatus({ ...newStatus, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" className="h-10 w-16 rounded-lg cursor-pointer bg-card2 border border-line" value={editStatus?.color || newStatus.color}
                onChange={(e) => editStatus ? setEditStatus({ ...editStatus, color: e.target.value }) : setNewStatus({ ...newStatus, color: e.target.value })} />
              <input className="input" value={editStatus?.color || newStatus.color} onChange={(e) => editStatus ? setEditStatus({ ...editStatus, color: e.target.value }) : setNewStatus({ ...newStatus, color: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={prioModal} onClose={() => setPrioModal(false)} title={editPrio ? 'Edit Priority' : 'Add Priority'}
        footer={<><button className="btn btn-ghost" onClick={() => setPrioModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={editPrio ? savePrio : addPrio}>{editPrio ? 'Save' : 'Add'}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">ID</label>
            <input className="input" value={editPrio?.id || newPrio.id} disabled={!!editPrio} onChange={(e) => setNewPrio({ ...newPrio, id: e.target.value.toLowerCase().replace(/ /g, '_') })} />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={editPrio?.name || newPrio.name} onChange={(e) => editPrio ? setEditPrio({ ...editPrio, name: e.target.value }) : setNewPrio({ ...newPrio, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Weight</label>
            <input type="number" min={1} max={10} className="input" value={editPrio?.weight ?? newPrio.weight}
              onChange={(e) => editPrio ? setEditPrio({ ...editPrio, weight: Number(e.target.value) }) : setNewPrio({ ...newPrio, weight: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" className="h-10 w-16 rounded-lg cursor-pointer bg-card2 border border-line" value={editPrio?.color || newPrio.color}
                onChange={(e) => editPrio ? setEditPrio({ ...editPrio, color: e.target.value }) : setNewPrio({ ...newPrio, color: e.target.value })} />
              <input className="input" value={editPrio?.color || newPrio.color} onChange={(e) => editPrio ? setEditPrio({ ...editPrio, color: e.target.value }) : setNewPrio({ ...newPrio, color: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={kpiModal} onClose={() => setKpiModal(false)} title="KPI Configuration"
        footer={<><button className="btn btn-ghost" onClick={() => setKpiModal(false)}>Close</button>
          <button className="btn btn-primary" onClick={saveKpi}><Save size={14} /> Done</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['completedTaskPoints', 'Completed Task Points'],
              ['onTimeBonus', 'On-Time Bonus'],
              ['overduePenalty', 'Overdue Penalty'],
              ['targetCompletionRate', 'Target Completion %'],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <input type="number" className="input" value={(settings.kpi as any)[k]}
                  onChange={(e) => setSettings({ ...settings, kpi: { ...settings.kpi, [k]: Number(e.target.value) } })} />
              </div>
            ))}
          </div>
          <Switch label="Difficulty bonus active" checked={settings.kpi.difficultyBonus}
            onChange={(v) => setSettings({ ...settings, kpi: { ...settings.kpi, difficultyBonus: v } })} />
          <div className="grid grid-cols-2 gap-3">
            {[
              ['reviewScoreWeight', 'Review Score Weight (0-1)'],
              ['productivityWeight', 'Productivity Weight (0-1)'],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <input type="number" step={0.1} className="input" value={(settings.kpi as any)[k]}
                  onChange={(e) => setSettings({ ...settings, kpi: { ...settings.kpi, [k]: Number(e.target.value) } })} />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!delHoliday} onClose={() => setDelHoliday(null)} onConfirm={async () => { await api.delete(`/settings/holidays/${delHoliday}`); setDelHoliday(null); api.get<{ id: number; date: string; name: string }[]>('/settings/holidays').then(setHolidays).catch(() => {}); toast('Holiday removed'); }}
        title="Remove holiday?" confirmLabel="Remove" danger />

      <ConfirmModal open={!!delStatus} onClose={() => setDelStatus(null)} onConfirm={deleteStatus}
        title="Delete task status?" message={`Delete "${delStatus?.name}"? Tasks currently in this status will be unaffected but the status option will no longer be available.`} confirmLabel="Delete" danger />

      <ConfirmModal open={!!delPrio} onClose={() => setDelPrio(null)} onConfirm={deletePrio}
        title="Delete priority level?" message={`Delete "${delPrio?.name}"? Tasks currently using this priority will keep it, but the priority option will no longer be available.`} confirmLabel="Delete" danger />
    </div>
  );
}
