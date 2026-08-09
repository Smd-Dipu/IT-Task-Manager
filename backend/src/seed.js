import { db } from './db.js';
import bcrypt from 'bcryptjs';
import { dateDaysAgo, addDays, today } from './utils.js';

export async function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const hash = (p) => bcrypt.hashSync(p, 10);

  db.exec('BEGIN');
  try {
    const users = [];
    const addUser = (name, email, role, team, dept, title) => {
      const r = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, title, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(name, email, hash('Taskflow@2026'), role, title);
      users.push({ id: Number(r.lastInsertRowid), name, email, role, team, dept });
      return users[users.length - 1];
    };

    const teams = [
      ['Platform', 'Core platform engineering'],
      ['Growth', 'Growth and marketing squad'],
      ['Operations', 'Operations and support'],
      ['Design', 'Product design team'],
    ];
    const teamIds = [];
    for (const [name, desc] of teams) {
      const r = db.prepare('INSERT INTO teams (name, description) VALUES (?, ?)').run(name, desc);
      teamIds.push(Number(r.lastInsertRowid));
    }

    const departments = [
      ['Engineering', 'Software engineering'],
      ['Product', 'Product management'],
      ['Design', 'Design department'],
      ['Marketing', 'Marketing department'],
      ['HR', 'Human resources'],
      ['Finance', 'Finance department'],
    ];
    const deptIds = [];
    for (const [name, desc] of departments) {
      const r = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(name, desc);
      deptIds.push(Number(r.lastInsertRowid));
    }

    const superAdmin = addUser('Alex Morgan', 'admin@taskflow.io', 'super_admin', teamIds[0], deptIds[0], 'Chief Executive Officer');
    const admins = [
      addUser('Sarah Chen', 'sarah@taskflow.io', 'admin', teamIds[0], deptIds[0], 'Engineering Manager'),
      addUser('David Park', 'david@taskflow.io', 'admin', teamIds[2], deptIds[3], 'Operations Director'),
    ];
    const members = [
      addUser('Emily Watson', 'emily@taskflow.io', 'user', teamIds[0], deptIds[0], 'Senior Engineer'),
      addUser('James Rodriguez', 'james@taskflow.io', 'user', teamIds[0], deptIds[1], 'Product Manager'),
      addUser('Olivia Brown', 'olivia@taskflow.io', 'user', teamIds[1], deptIds[3], 'Growth Marketer'),
      addUser('Liam Johnson', 'liam@taskflow.io', 'user', teamIds[2], deptIds[4], 'HR Specialist'),
      addUser('Sophia Martinez', 'sophia@taskflow.io', 'user', teamIds[1], deptIds[3], 'Content Strategist'),
      addUser('Noah Davis', 'noah@taskflow.io', 'user', teamIds[0], deptIds[0], 'Frontend Engineer'),
      addUser('Ava Wilson', 'ava@taskflow.io', 'user', teamIds[3], deptIds[2], 'Product Designer'),
      addUser('Mason Taylor', 'mason@taskflow.io', 'user', teamIds[2], deptIds[5], 'Financial Analyst'),
    ];

    const allPeople = [...admins, ...members];
    const assignTeam = (u) => {
      db.prepare('UPDATE users SET team_id = ?, department_id = ? WHERE id = ?')
        .run(u.team ?? teamIds[0], u.dept ?? deptIds[0], u.id);
    };
    [...admins, ...members].forEach(assignTeam);
    db.prepare('UPDATE users SET team_id = ?, department_id = ? WHERE id = ?')
      .run(superAdmin.team, superAdmin.dept, superAdmin.id);

    db.prepare('UPDATE teams SET lead_id = ? WHERE id = ?').run(admins[0].id, teamIds[0]);
    db.prepare('UPDATE teams SET lead_id = ? WHERE id = ?').run(members[1].id, teamIds[1]);
    db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(admins[0].id, deptIds[0]);
    db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(admins[1].id, deptIds[3]);

    const flagSet = ['Development', 'Client', 'Bug', 'Security', 'Design', 'Testing', 'Finance', 'Urgent'];
    const tagSet = ['frontend', 'backend', 'api', 'design', 'research', 'infra', 'marketing', 'data', 'mobile', 'automation'];
    const titles = [
      'Implement OAuth2 single sign-on flow',
      'Redesign analytics dashboard home',
      'Fix intermittent 503 errors on checkout',
      'Q3 customer onboarding campaign',
      'Migrate legacy billing service to new stack',
      'Design mobile app onboarding screens',
      'Build KPI reporting module',
      'Annual security audit remediation',
      'Automate CI deployment pipeline',
      'Customer support knowledge base',
      'Optimize database query performance',
      'Plan product roadmap for next quarter',
      'Update privacy policy and terms',
      'Create developer documentation portal',
      'Set up monitoring and alerting stack',
      'Refactor notification service',
      'Run usability testing sessions',
      'Prepare investor pitch deck',
      'Improve search relevance scoring',
      'Data warehouse migration to Snowflake',
    ];

    const statuses = ['todo', 'discussion', 'in_progress', 'in_review', 'done', 'cancelled'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    const difficulties = ['easy', 'medium', 'hard', 'critical'];
    const types = ['task', 'bug', 'feature', 'research', 'design', 'infra'];

    const taskIds = [];
    for (let i = 0; i < titles.length; i++) {
      const createdDaysAgo = (i * 3) % 60;
      const created = dateDaysAgo(createdDaysAgo);
      const status = i < 3 ? 'done' : statuses[i % statuses.length];
      const priority = priorities[i % priorities.length];
      const difficulty = difficulties[i % difficulties.length];
      const dueDaysFromNow = (i % 14) - 5;
      const due = addDays(today(), dueDaysFromNow);
      const assignees = [
        allPeople[i % allPeople.length],
        allPeople[(i + 3) % allPeople.length],
      ];
      const progress = status === 'done' ? 100 : (i * 17) % 90;
      const createdBy = superAdmin.id;
      const flags = JSON.stringify([flagSet[i % flagSet.length], flagSet[(i + 5) % flagSet.length]]);
      const tags = JSON.stringify([tagSet[i % tagSet.length], tagSet[(i + 2) % tagSet.length]]);

      const r = db.prepare(`
        INSERT INTO tasks (
          title, description, status, priority, difficulty, task_type, flags, tags,
          budget, estimated_hours, due_date, created_by, reviewer_id, team_id, department_id,
          progress, approval_status, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        titles[i],
        `Detailed description for "${titles[i]}". This task was seeded for demo purposes and includes context, acceptance criteria and out-of-scope notes.`,
        status, priority, difficulty, types[i % types.length], flags, tags,
        Math.round((i * 137) % 50) * 100, (i % 8) + 2, due, createdBy,
        allPeople[(i + 1) % allPeople.length].id, teamIds[i % teamIds.length], deptIds[i % deptIds.length],
        progress, 'none', `${created} ${String(9 + (i % 8)).padStart(2, '0')}:00`, dateDaysAgo(createdDaysAgo > 0 ? createdDaysAgo - 1 : 0),
        status === 'done' ? dateDaysAgo(Math.max(0, createdDaysAgo - 2)) : null,
      );
      const taskId = Number(r.lastInsertRowid);
      taskIds.push(taskId);

      const updateProgress = status === 'done' ? 100 : progress;
      for (let j = 0; j < assignees.length; j++) {
        db.prepare(`
          INSERT INTO task_assignees (task_id, user_id, progress, status, assigned_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(taskId, assignees[j].id, updateProgress, status === 'done' ? 'done' : status,
          `${created} 09:00`, status === 'done' ? dateDaysAgo(1) : null);
      }

      if (i % 3 === 0) {
        db.prepare(`INSERT INTO task_comments (task_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`)
          .run(taskId, assignees[0].id, 'Any update on this one? Looks like we are on track.', `${created} 14:30`);
      }
      if (i % 4 === 0) {
        db.prepare(`INSERT INTO task_comments (task_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`)
          .run(taskId, assignees[1].id, 'Working on this today. Will push a branch shortly.', `${created} 10:15`);
      }
      if (i % 5 === 0) {
        const checklist = ['Initial research', 'Implementation', 'Code review', 'Deploy to staging'];
        checklist.forEach((c, ci) => {
          db.prepare(`INSERT INTO task_checklist (task_id, title, done, created_by) VALUES (?, ?, ?, ?)`)
            .run(taskId, c, status === 'done' ? 1 : (ci <= (i % 4) ? 1 : 0), createdBy);
        });
      }
      if (i % 7 === 0) {
        db.prepare(`INSERT INTO time_entries (task_id, user_id, hours, note, date) VALUES (?, ?, ?, ?, ?)`)
          .run(taskId, assignees[0].id, 1.5 + (i % 4), 'Focused work', created);
      }
      if (i % 9 === 0) {
        db.prepare(`INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, 'task', ?, ?, ?)`)
          .run(assignees[0].id, 'Task assigned to you', titles[i], created);
      }
    }

    for (const u of allPeople.slice(0, 6)) {
      db.prepare(`INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, 'system', 'Welcome to TaskFlow', ?, ?)`)
        .run(u.id, `Your account is ready. Complete your profile to get started.`, dateDaysAgo(20));
    }

    db.prepare(`INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, 'deadline', 'Deadline approaching', ?, ?)`)
      .run(members[0].id, 'Several of your tasks are due within the next 24 hours.', dateDaysAgo(0));

    db.prepare(`INSERT INTO audit_logs (user_id, user_name, action, entity_type, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(superAdmin.id, superAdmin.name, 'system.seed', 'system', 'Initial database seeded with demo data', dateDaysAgo(20));

    const holiday = today();
    db.prepare(`INSERT INTO holidays (date, name) VALUES (?, ?)`).run(holiday, 'Platform launch day');

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
