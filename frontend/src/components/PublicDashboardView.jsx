import React, { useState, useEffect } from 'react';
import ProjectDashboardView from './ProjectDashboardView';
import { apiFetch } from '../api';

export default function PublicDashboardView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const pathParts = window.location.pathname.split('/');
        // e.g. /public/dashboard/projects/TOKEN
        const type = pathParts[3];
        const token = pathParts[4];
        
        if (!type || !token) {
          throw new Error('Invalid dashboard link.');
        }

        const response = await apiFetch(`/api/public/${type}/${token}/dashboard`);
        const result = await response.json();

        if (response.ok) {
          setData(result);
        } else {
          throw new Error(result.error || 'Failed to load dashboard.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={styles.centerContainer}>Loading dashboard...</div>;
  }

  if (error) {
    return <div style={styles.centerContainer}><div style={styles.errorBox}>{error}</div></div>;
  }

  if (!data) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleRow}>
            {data.icon && <span style={styles.icon}>{data.icon}</span>}
            <h1 style={styles.title}>{data.name}</h1>
            <span style={styles.badge}>Public Dashboard</span>
          </div>
          {data.description && <div style={styles.description} dangerouslySetInnerHTML={{ __html: data.description }} />}
        </div>
      </header>

      <main style={styles.main}>
        <ProjectDashboardView selectedProject={data} isReadOnly={true} />
      </main>
    </div>
  );
}

const styles = {
  centerContainer: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif' },
  errorBox: { padding: '2rem', backgroundColor: '#FEF2F2', color: '#B91C1C', borderRadius: '8px', border: '1px solid #FCA5A5', fontWeight: '500' },
  container: { minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif', color: '#111827' },
  header: { backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '2rem 1.5rem' },
  headerContent: { margin: '0 auto' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' },
  icon: { fontSize: '2rem' },
  title: { margin: 0, fontSize: '1.75rem', fontWeight: '700' },
  badge: { backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: '600' },
  description: { margin: 0, color: '#6B7280', fontSize: '1.05rem', maxWidth: '800px', lineHeight: 1.5 },
  main: { margin: '2rem', padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', minHeight: '600px' }
};
