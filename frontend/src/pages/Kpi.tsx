import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, TrendingDown, Award, Download, Crown, Timer, Target, AlertTriangle, Star, Zap } from 'lucide-react';
import { api, downloadExport } from '../lib/api';
import type { KpiEntry } from '../lib/types';
import { Avatar, Badge, useToast, Skeleton, EmptyState } from '../components/ui';
import { BarChartCard, LineChartCard, DonutChartCard, ChartCard } from '../components/charts';
import { DATE_PRESETS } from '../lib/utils';
import { buildQuery } from '../lib/utils';

interface Overview {
  top: (KpiEntry & { team_name?: string })[];
  lowest: (KpiEntry & { team_name?: string })[];
  teamRank: { name: string; score: number; completed: number; count: number }[];
  deptRank: { name: string; score: number; completed: number; count: number }[];
  monthly: { month: string; avgScore: number; totalCompleted: number }[];
  yearly: { year: string; avgScore: number; totalCompleted: number }[];
}

export default function Kpi() {
  const toast = useToast();
  const [period, setPeriod] = useState('month');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<KpiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'users'>('overview');

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const [ov, us] = await Promise.all([
        api.get<Overview>(`/kpi/overview`, { dateKey: p }),
        api.get<KpiEntry[]>(`/kpi/users`, { dateKey: p }),
      ]);
      setOverview(ov);
      setUsers(us);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(period); }, [period, load]);

  if (loading && !overview) return <div className="max-w-[1200px] mx-auto space-y-4"><Skeleton className="h-10 w-64" /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div></div>;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><Award size={24} className="text-brand" /> KPI Management</h1>
          <p className="text-sm text-ink2 mt-0.5">Performance scoring · difficulty weighted · on-time bonuses</p>
        </div>
        <div className="flex gap-2">
          <select className="input !w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {DATE_PRESETS.filter((d) => d.key !== 'custom').map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => downloadExport(`/reports/export?type=kpi&format=csv&dateKey=${period}`, 'kpi.csv')}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-card2 rounded-xl p-1 w-fit">
        <button className={tab === 'overview' ? 'tab tab-active' : 'tab'} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'users' ? 'tab tab-active' : 'tab'} onClick={() => setTab('users')}>User KPI Table</button>
      </div>

      {tab === 'overview' && overview && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Top Performers" subtitle="Highest KPI scores this period" action={<Badge color="#22c55e"><Trophy size={11} /> Top</Badge>}>
              <div className="space-y-2">
                {overview.top.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-card2/60">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shrink-0" style={{ background: ['#f59e0b', '#94a3b8', '#b45309'][i] || '#6366f1' }}>
                      {i + 1}
                    </span>
                    <Avatar name={u.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{u.name}</div>
                      <div className="text-xs text-ink3">{u.team_name || '—'} · {u.completed} done · {u.completionRate}% rate</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-lg" style={{ color: i === 0 ? '#f59e0b' : 'rgb(var(--text))' }}>{u.score}</div>
                      <div className="text-[10px] text-ink3">points</div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="Lowest Performers" subtitle="Need attention this period" action={<Badge color="#ef4444"><TrendingDown size={11} /> Watch</Badge>}>
              <div className="space-y-2">
                {overview.lowest.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-card2/60">
                    <span className="w-7 h-7 rounded-lg bg-bad/10 text-bad flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                    <Avatar name={u.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{u.name}</div>
                      <div className="text-xs text-ink3">{u.team_name || '—'} · {u.overdueCount} overdue</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-lg text-bad">{u.score}</div>
                      <div className="text-[10px] text-ink3">points</div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <BarChartCard title="Team Ranking" subtitle="Total KPI score by team" data={overview.teamRank.map((t) => ({ name: t.name, score: t.score, completed: t.completed }))} xKey="name"
              series={[{ key: 'score', name: 'Score', color: '#6366f1' }, { key: 'completed', name: 'Completed', color: '#22c55e' }]} />
            <BarChartCard title="Department Ranking" subtitle="Total KPI score by department" data={overview.deptRank.map((t) => ({ name: t.name, score: t.score, completed: t.completed }))} xKey="name"
              series={[{ key: 'score', name: 'Score', color: '#8b5cf6' }, { key: 'completed', name: 'Completed', color: '#14b8a6' }]} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <LineChartCard title="Monthly KPI" subtitle="Average score per month (last 12)" data={overview.monthly} xKey="month"
              series={[{ key: 'avgScore', name: 'Avg Score', color: '#6366f1' }, { key: 'totalCompleted', name: 'Completed', color: '#22c55e' }]} />
            <LineChartCard title="Yearly KPI" subtitle="Average score per year" data={overview.yearly} xKey="year"
              series={[{ key: 'avgScore', name: 'Avg Score', color: '#8b5cf6' }, { key: 'totalCompleted', name: 'Completed', color: '#f97316' }]} />
          </div>

          <ChartCard title="User KPI Breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink3 uppercase tracking-wider border-b border-line">
                    <th className="px-3 py-2.5">User</th><th className="px-3 py-2.5">Team</th><th className="px-3 py-2.5">Completed</th>
                    <th className="px-3 py-2.5">On-Time</th><th className="px-3 py-2.5">Overdue</th><th className="px-3 py-2.5">Rate</th>
                    <th className="px-3 py-2.5">Avg Hours</th><th className="px-3 py-2.5">Points</th><th className="px-3 py-2.5">Bonus</th>
                    <th className="px-3 py-2.5">Penalty</th><th className="px-3 py-2.5 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} className="border-b border-line last:border-0 hover:bg-card2">
                      <td className="px-3 py-2.5 font-semibold">{u.name}</td>
                      <td className="px-3 py-2.5 text-ink2">{u.team_name || '—'}</td>
                      <td className="px-3 py-2.5">{u.completed}</td>
                      <td className="px-3 py-2.5 text-ok">{u.onTime}</td>
                      <td className="px-3 py-2.5 text-bad">{u.overdueCount}</td>
                      <td className="px-3 py-2.5">{u.completionRate}%</td>
                      <td className="px-3 py-2.5">{u.avgCompletionHours}h</td>
                      <td className="px-3 py-2.5">{u.points}</td>
                      <td className="px-3 py-2.5 text-ok">+{u.bonus}</td>
                      <td className="px-3 py-2.5 text-bad">-{u.penalty}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-brand">{u.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}

      {tab === 'users' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...users].sort((a, b) => b.score - a.score).map((u) => (
            <div key={u.userId} className="card card-hover p-4 anim-in">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{u.name}</div>
                  <div className="text-xs text-ink3 truncate">{u.team_name || 'No team'}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-xl text-brand">{u.score}</div>
                  <div className="text-[10px] text-ink3 uppercase">score</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                <MiniStat icon={<CheckCircleIcon />} label="Done" value={u.completed} color="#22c55e" />
                <MiniStat icon={<Timer size={13} />} label="On-time" value={u.onTime} color="#3b82f6" />
                <MiniStat icon={<AlertTriangle size={13} />} label="Overdue" value={u.overdueCount} color="#ef4444" />
                <MiniStat icon={<Target size={13} />} label="Rate" value={`${u.completionRate}%`} color="#8b5cf6" />
              </div>
            </div>
          ))}
          {users.length === 0 && <EmptyState icon={<Award size={26} />} title="No KPI data" subtitle="No performance data for this period." />}
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>; }

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="p-2 rounded-lg bg-card2/70">
      <div className="flex items-center justify-center gap-1" style={{ color }}>{icon}</div>
      <div className="font-bold text-sm mt-1">{value}</div>
      <div className="text-[10px] text-ink3">{label}</div>
    </div>
  );
}
