import React, { useEffect, useState } from 'react';
import { UserCircle, KeyRound, Upload, Mail, Building2, Users, Award, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast, Avatar, Badge, Skeleton } from '../components/ui';
import { fmtDate } from '../lib/utils';

export default function Profile() {
  const { user, refreshUser, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: user?.name || '', title: user?.title || '', phone: user?.phone || '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [kpi, setKpi] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    setProfile({ name: user.name, title: user.title || '', phone: user.phone || '' });
    api.get<any>('/kpi/me').then(setKpi).catch(() => {});
  }, [user]);

  if (!user) return null;

  const saveProfile = async () => {
    setSaving(true);
    try {
      const u = await api.put<{ id: number; name: string; title?: string; phone?: string; avatar?: string; role: string; email: string }>('/users/me/profile', profile);
      setUser({ ...user, name: u.name, title: u.title, phone: u.phone });
      toast('Profile updated');
      refreshUser();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const savePwd = async () => {
    if (pwd.newPassword.length < 6) return toast('Password must be at least 6 characters', 'error');
    if (pwd.newPassword !== pwd.confirm) return toast('Passwords do not match', 'error');
    setPwdSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed');
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setPwdSaving(false); }
  };

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const r = await api.upload<{ url: string }>('/uploads/avatar', fd);
      setUser({ ...user, avatar: r.url });
      toast('Profile picture updated');
      refreshUser();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const roleLabel: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', user: 'User' };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><UserCircle size={24} className="text-brand" /> My Profile</h1>
        <p className="text-sm text-ink2 mt-0.5">Manage your personal information and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <div className="card p-6 text-center">
            <div className="relative inline-block">
              <Avatar name={user.name} src={user.avatar} size={96} />
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gradient-bg text-white flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                <Upload size={14} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
            </div>
            <h2 className="font-bold text-lg mt-4">{user.name}</h2>
            <p className="text-sm text-ink2">{user.email}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Badge color="#8b5cf6"><Shield size={11} /> {roleLabel[user.role]}</Badge>
              {user.is_active && <Badge color="#22c55e">Active</Badge>}
            </div>
            {user.title && <div className="text-xs text-ink3 mt-2">{user.title}</div>}
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Organization</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-ink2"><Users size={14} className="text-brand" /> <span className="text-ink3">Team:</span> {user.team_name || '—'}</div>
              <div className="flex items-center gap-2 text-ink2"><Building2 size={14} className="text-brand" /> <span className="text-ink3">Department:</span> {user.department_name || '—'}</div>
              <div className="flex items-center gap-2 text-ink2"><Mail size={14} className="text-brand" /> <span className="text-ink3">Member since:</span> {fmtDate(user.created_at)}</div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm flex items-center gap-2"><Award size={14} className="text-brand" /> My KPI</h3>
            {!kpi ? <Skeleton className="h-20" /> : (
              <div className="text-center">
                <div className="text-4xl font-extrabold gradient-text">{kpi.score}</div>
                <div className="text-xs text-ink3">Performance score</div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <Mini label="Completed" value={kpi.completed} />
                  <Mini label="On-Time" value={kpi.onTime} />
                  <Mini label="Overdue" value={kpi.overdueCount} />
                </div>
                <div className="mt-3 text-xs text-ink2">Completion rate: <b>{kpi.completionRate}%</b> · Avg {kpi.avgCompletionHours}h</div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h3 className="font-bold mb-4">Profile Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Job Title</label>
                <input className="input" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={user.email} disabled />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary mt-5" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><KeyRound size={16} className="text-brand" /> Change Password</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="label">Current Password</label>
                <input type="password" className="input" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">New Password</label>
                  <input type="password" className="input" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
                </div>
                <div>
                  <label className="label">Confirm</label>
                  <input type="password" className="input" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={savePwd} disabled={pwdSaving}>{pwdSaving ? 'Updating...' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-2 rounded-lg bg-card2/70">
      <div className="font-bold">{value}</div>
      <div className="text-[10px] text-ink3">{label}</div>
    </div>
  );
}
