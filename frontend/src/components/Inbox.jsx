import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { apiFetch, API_BASE_URL } from '../api';

export default function Inbox({ token, user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    if (user && user.id) {
      const socket = io(API_BASE_URL);
      socket.emit('join_user', user.id);

      socket.on('notification_received', () => {
        fetchNotifications();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await apiFetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif', backgroundColor: 'var(--bg-primary)' },
    topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem 1rem 2rem' },
    title: { fontSize: '1.25rem', fontWeight: '500', color: 'var(--text-primary)', margin: 0 },
    manageBtn: { backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' },
    tabsContainer: { display: 'flex', gap: '1.5rem', padding: '0 2rem', borderBottom: '1px solid #E5E7EB', color: 'var(--text-secondary)', fontSize: '0.85rem' },
    tabActive: { color: 'var(--text-primary)', paddingBottom: '0.5rem', borderBottom: '2px solid var(--text-primary)', cursor: 'pointer' },
    tabInactive: { paddingBottom: '0.5rem', cursor: 'pointer', borderBottom: '2px solid transparent' },
    toolbarContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 2rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.75rem', color: 'var(--text-secondary)' },
    toolbarGroup: { display: 'flex', gap: '1.2rem', alignItems: 'center' },
    toolbarBtn: { display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.75rem' },
    list: { display: 'flex', flexDirection: 'column', gap: '0', padding: '0 2rem' },
    item: { display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #E5E7EB', backgroundColor: 'var(--bg-primary)', cursor: 'pointer' },
    itemUnread: { backgroundColor: 'var(--bg-secondary)' },
    iconBox: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 },
    content: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' },
    message: { color: 'var(--text-primary)', fontSize: '0.9rem' },
    meta: { color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'flex', gap: '0.5rem' },
    dot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4F46E5', marginTop: '0.5rem' }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'ASSIGNED': return '👤';
      case 'COMPLETED': return '✅';
      case 'COMMENTED': return '💬';
      default: return '🔔';
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading Inbox...</div>;

  return (
    <div style={styles.container}>
      {/* 1. Top Header */}
      <div style={styles.topHeader}>
        <h1 style={styles.title}>Inbox</h1>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          {notifications.some(n => !n.isRead) && (
            <button style={{...styles.manageBtn, border: 'none', color: '#4F46E5'}} onClick={handleMarkAllAsRead}>Mark all as read</button>
          )}
          <button style={styles.manageBtn}>Manage notifications</button>
        </div>
      </div>

      {/* 2. Tabs */}
      <div style={styles.tabsContainer}>
        <div style={styles.tabActive}>Activity</div>
        <div style={styles.tabInactive}>Bookmarks</div>
        <div style={styles.tabInactive}>Archive</div>
        <div style={styles.tabInactive}>@Mentioned</div>
        <div style={styles.tabInactive}>+</div>
      </div>

      {/* 3. Toolbar */}
      <div style={styles.toolbarContainer}>
        <div style={styles.toolbarGroup}>
          <button style={styles.toolbarBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Filter
          </button>
          <button style={styles.toolbarBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
            Sort: Newest
          </button>
          <button style={styles.toolbarBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            Density: Detailed
          </button>
        </div>
        <button style={styles.toolbarBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </button>
      </div>

      {/* 4. Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3>You're all caught up!</h3>
            <p>No new notifications.</p>
          </div>
        ) : (
          <div style={styles.list}>
            {notifications.map(n => (
              <div 
                key={n.id} 
                style={{ ...styles.item, ...(n.isRead ? {} : styles.itemUnread) }}
                onClick={() => { if(!n.isRead) handleMarkAsRead(n.id); }}
              >
                <div style={styles.iconBox}>{getIcon(n.type)}</div>
                <div style={styles.content}>
                  <div style={{ ...styles.message, fontWeight: n.isRead ? 'normal' : '500' }}>
                    {n.message}
                  </div>
                  <div style={styles.meta}>
                    {n.actor?.name && <span>{n.actor.name}</span>}
                    <span>•</span>
                    <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                    {n.project && (
                      <>
                        <span>•</span>
                        <span>{n.project.name}</span>
                      </>
                    )}
                  </div>
                </div>
                {!n.isRead && <div style={styles.dot} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
