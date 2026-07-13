import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ProjectDashboardView({ selectedProject }) {
  // Compute Metrics
  const { totalTasks, completedTasks, incompleteTasks, tasksBySection, tasksByAssignee } = useMemo(() => {
    let total = 0;
    let completed = 0;
    let incomplete = 0;
    
    const bySection = [];
    const assigneeMap = {};

    selectedProject.sections?.forEach(sec => {
      let secTotal = 0;
      let secCompleted = 0;
      
      sec.tasks?.forEach(task => {
        total++;
        secTotal++;
        if (task.isCompleted) {
          completed++;
          secCompleted++;
        } else {
          incomplete++;
        }

        // Assignee metrics
        const assigneeName = task.assignee?.name || 'Unassigned';
        if (!assigneeMap[assigneeName]) assigneeMap[assigneeName] = 0;
        assigneeMap[assigneeName]++;
      });

      bySection.push({
        name: sec.name,
        Completed: secCompleted,
        Incomplete: secTotal - secCompleted
      });
    });

    const byAssignee = Object.keys(assigneeMap).map(key => ({
      name: key,
      value: assigneeMap[key]
    })).sort((a, b) => b.value - a.value);

    return { totalTasks: total, completedTasks: completed, incompleteTasks: incomplete, tasksBySection: bySection, tasksByAssignee: byAssignee };
  }, [selectedProject]);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', 'var(--text-secondary)'];

  return (
    <div style={styles.dashboardContainer}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Dashboard</h2>
      </div>

      {/* Metrics Summary Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Incomplete tasks</div>
          <div style={styles.metricValue}>{incompleteTasks}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Completed tasks</div>
          <div style={styles.metricValue}>{completedTasks}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Total tasks</div>
          <div style={styles.metricValue}>{totalTasks}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={styles.chartsGrid}>
        {/* Task Completion by Section */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Tasks by Section</h3>
          <div style={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksBySection} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Completed" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Incomplete" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tasks by Assignee */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Tasks by Assignee</h3>
          <div style={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tasksByAssignee}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {tasksByAssignee.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  dashboardContainer: { padding: '2rem', flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-secondary)' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' },
  addChartBtn: { backgroundColor: 'var(--bg-primary)', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  metricCard: { backgroundColor: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '0.5rem' },
  metricValue: { fontSize: '2.5rem', color: 'var(--text-primary)', fontWeight: '300' },
  chartsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' },
  chartCard: { backgroundColor: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  chartTitle: { fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 1.5rem 0' },
  chartWrapper: { width: '100%', height: '300px' }
};
