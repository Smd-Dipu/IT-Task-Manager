import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, Users, Building2, UserCog, Award, BarChart3,
  ScrollText, Settings as SettingsIcon, LogOut, Bell, Search, Sun, Moon,
  Menu, X, ChevronRight, UserCircle, CalendarDays, ShieldCheck, Flag,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import type { Notification } from '../lib/types';
import { timeAgo, cx, statusById } from '../lib/utils';
import { useSettings } from '../lib/settings';
import { useNotifications } from '../lib/useNotifications';
import { notifTypeMeta } from '../lib/notifications';
import { Avatar, Badge } from './ui';

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'User',
};

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifs, unread, refresh, markOne, markAll } = useNotifications();

  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  const openBell = () => {
    refresh();
    setNotifOpen((o) => !o);
  };

  const handleNotifClick = async (n: Notification) => {
    if (!n.read) await markOne(n.id);
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/tasks?search=${encodeURIComponent(search.trim())}`);
    setSearch('');
  };

  const markAllRead = async () => {
    await markAll();
  };

  const navGroups = useMemo(() => {
    const main = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/tasks', label: 'Tasks', icon: ListTodo },
      { to: '/priority-tasks', label: 'Priority Task', icon: Flag },
    ];
    const admin = [
      { to: '/users', label: 'Users', icon: UserCog },
      { to: '/teams', label: 'Teams', icon: Users },
      { to: '/departments', label: 'Departments', icon: Building2 },
      { to: '/kpi', label: 'KPI Management', icon: Award },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/audit', label: 'Audit Logs', icon: ScrollText },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ];
    const groups: { title?: string; items: typeof main }[] = [{ items: main }];
    if (isAdmin) groups.push({ title: 'Administration', items: admin });
    groups.push({ title: 'Account', items: [{ to: '/profile', label: 'Profile', icon: UserCircle }] });
    return groups;
  }, [isAdmin]);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center text-white shadow-lg">
          <ListTodo size={20} />
        </div>
        <div>
          <div className="font-bold text-lg leading-none gradient-text">TaskFlow</div>
          <div className="text-[10px] text-ink3 mt-0.5">Enterprise Task Manager</div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {navGroups.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.title && <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink3">{g.title}</div>}
            {g.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-brand/20 to-brand2/10 text-brand shadow-inner border border-brand/20'
                    : 'text-ink2 hover:bg-card2 hover:text-ink',
                )}
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                {item.to === '/tasks' && <span className="text-[10px] text-ink3">⌘K</span>}
                <ChevronRight size={13} className="opacity-40" />
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-line">
        <div className="card p-3 flex items-center gap-2.5" style={{ background: 'rgb(var(--card-2))' }}>
          <Avatar name={user?.name} src={user?.avatar} size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <Badge color="#8b5cf6" className="mt-0.5">{roleLabel[user?.role || 'user']}</Badge>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-lg hover:bg-bad/10 text-ink2 hover:text-bad" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex overflow-hidden">
      <aside className="hidden lg:flex w-64 shrink-0 h-full border-r border-line glass">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 glass anim-slide" style={{ background: 'rgb(var(--bg))' }}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 p-1.5 rounded-lg text-ink2 hover:bg-card2"><X size={18} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="glass sticky top-0 z-40 border-b border-line px-4 md:px-6 h-16 flex items-center gap-3">
          <button className="lg:hidden p-2 rounded-lg hover:bg-card2 text-ink2" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>

          <form onSubmit={onSearch} className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, users, teams..."
              className="input !pl-9 !py-2 rounded-full"
            />
          </form>

          <div className="flex-1" />

          <div className="relative" ref={notifRef}>
            <button
              onClick={openBell}
              className="relative p-2 rounded-lg hover:bg-card2 text-ink2 transition-colors"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="card anim-pop absolute right-0 mt-2 w-96 max-w-[90vw] z-50 overflow-hidden" style={{ background: 'rgb(var(--card))' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <div className="font-semibold text-sm flex items-center gap-2"><Bell size={15} className="text-brand" /> Notifications</div>
                  {unread > 0 && <button onClick={markAllRead} className="text-xs text-brand font-medium hover:underline">Mark all read</button>}
                </div>
                <div className="max-h-[380px] overflow-y-auto">
                  {notifs.length === 0 && <div className="p-8 text-center text-sm text-ink3">No notifications yet</div>}
                  {notifs.map((n) => {
                    const meta = notifTypeMeta(n.type);
                    return (
                      <button key={n.id} onClick={() => handleNotifClick(n)} className="w-full text-left px-4 py-3 hover:bg-card2 border-b border-line last:border-0 flex gap-3">
                        <span className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}1a`, color: meta.color }}>
                          <meta.icon size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={cx('text-sm truncate', n.read ? 'text-ink2' : 'font-semibold text-ink')}>{n.title}</div>
                          <div className="text-xs text-ink3 truncate">{n.message}</div>
                          <div className="text-[10px] text-ink3 mt-0.5">{timeAgo(n.created_at)}</div>
                        </div>
                        {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-brand" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button onClick={toggle} className="p-2 rounded-lg hover:bg-card2 text-ink2 transition-colors" title="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative">
            <button onClick={() => navigate('/profile')} className="flex items-center gap-2">
              <Avatar name={user?.name} src={user?.avatar} size={34} />
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold leading-none">{user?.name}</div>
                <div className="text-[11px] text-ink3 mt-0.5">{user?.email}</div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
