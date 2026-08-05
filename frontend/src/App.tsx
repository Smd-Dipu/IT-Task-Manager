import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Users from './pages/Users';
import Teams from './pages/Teams';
import Departments from './pages/Departments';
import Kpi from './pages/Kpi';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Audit from './pages/Audit';
import Profile from './pages/Profile';

function Protected({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/new" element={<Tasks />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/users" element={<Protected adminOnly><Users /></Protected>} />
        <Route path="/teams" element={<Protected adminOnly><Teams /></Protected>} />
        <Route path="/departments" element={<Protected adminOnly><Departments /></Protected>} />
        <Route path="/kpi" element={<Protected adminOnly><Kpi /></Protected>} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit" element={<Protected adminOnly><Audit /></Protected>} />
        <Route path="/settings" element={<Protected adminOnly><SettingsPage /></Protected>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
