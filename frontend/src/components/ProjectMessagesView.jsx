import React, { useState, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';
import { apiFetch } from '../api';

const styles = {
  container: {
    padding: '24px 32px',
    maxWidth: '1200px',
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 auto',
    fontFamily: 'var(--font-primary)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '20px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    margin: 0
  },
  newMessageBtn: {
    padding: '8px 16px',
    backgroundColor: '#4F46E5', // Indigo color matching primary buttons
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  composerContainer: {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  inputSubject: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderBottom: 'none',
    borderRadius: '4px 4px 0 0',
    fontSize: '16px',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box'
  },
  inputBody: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '0 0 4px 4px',
    fontSize: '14px',
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  composerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '12px'
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '8px 16px',
    backgroundColor: '#4F46E5',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  messageCard: {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '16px'
  },
  authorName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0
  },
  messageDate: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: 0
  },
  messageSubject: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginTop: '0',
    marginBottom: '8px'
  },
  messageBody: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    margin: 0
  },
  repliesSection: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0'
  },
  replyCard: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  replyAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#94a3b8',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '13px',
    flexShrink: 0
  },
  replyContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '8px'
  },
  replyAuthor: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 4px 0'
  },
  replyText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    margin: 0,
    whiteSpace: 'pre-wrap'
  },
  replyComposer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    marginTop: '16px'
  },
  replyInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: '40px',
    resize: 'vertical'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: 'var(--text-secondary)'
  }
};

export default function ProjectMessagesView({ selectedProject, token, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  
  const [replyText, setReplyText] = useState({}); // messageId -> text

  const allUsers = React.useMemo(() => {
    let list = selectedProject?.members?.map(m => m.user) || [];
    if (selectedProject?.owner && !list.find(u => u.id === selectedProject.owner.id)) {
      list.push(selectedProject.owner);
    }
    if (currentUser && !list.find(u => u.id === currentUser.id)) {
      list.push(currentUser);
    }
    return list;
  }, [selectedProject, currentUser]);

  useEffect(() => {
    fetchMessages();
  }, [selectedProject.id]);

  const fetchMessages = async () => {
    try {
      const res = await apiFetch(`/api/projects/${selectedProject.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async () => {
    if (!newBody.trim()) return;
    try {
      const res = await apiFetch(`/api/projects/${selectedProject.id}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ subject: newSubject, body: newBody })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages([newMsg, ...messages]);
        setIsComposing(false);
        setNewSubject('');
        setNewBody('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReply = async (messageId) => {
    const text = replyText[messageId];
    if (!text || !text.trim()) return;

    try {
      const res = await apiFetch(`/api/projects/${selectedProject.id}/messages/${messageId}/replies`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const newReply = await res.json();
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return { ...msg, replies: [...msg.replies, newReply] };
          }
          return msg;
        }));
        setReplyText(prev => ({ ...prev, [messageId]: '' }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Messages</h2>
        {!isComposing && (
          <button style={styles.newMessageBtn} onClick={() => setIsComposing(true)}>
            + New message
          </button>
        )}
      </div>

      {isComposing && (
        <div style={styles.composerContainer}>
          <input 
            type="text" 
            placeholder="Subject (optional)" 
            style={styles.inputSubject}
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          />
          <RichTextEditor 
            value={newBody}
            onChange={(val) => setNewBody(val)}
            users={allUsers}
            minHeight="120px"
          />
          <div style={styles.composerActions}>
            <button style={styles.cancelBtn} onClick={() => setIsComposing(false)}>Cancel</button>
            <button style={styles.submitBtn} onClick={handleSendMessage} disabled={!newBody.trim()}>Send</button>
          </div>
        </div>
      )}

      <div className="messages-list">
        {messages.length === 0 && !isComposing && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <h3>Start a conversation</h3>
            <p>Send a message to update your team, make an announcement, or share an idea.</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={styles.messageCard}>
            <div style={styles.messageHeader}>
              <div style={styles.avatar}>{getInitials(msg.user?.name)}</div>
              <div>
                <p style={styles.authorName}>{msg.user?.name || 'Unknown User'}</p>
                <p style={styles.messageDate}>{formatDate(msg.createdAt)}</p>
              </div>
            </div>
            
            {msg.subject && <h3 style={styles.messageSubject}>{msg.subject}</h3>}
            <div className="rich-text-content" style={styles.messageBody} dangerouslySetInnerHTML={{ __html: msg.body }} />

            <div style={styles.repliesSection}>
              {msg.replies && msg.replies.map(reply => (
                <div key={reply.id} style={styles.replyCard}>
                  <div style={styles.replyAvatar}>{getInitials(reply.user?.name)}</div>
                  <div style={styles.replyContent}>
                    <p style={styles.replyAuthor}>{reply.user?.name || 'Unknown User'} <span style={{fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: 8}}>{formatDate(reply.createdAt)}</span></p>
                    <div className="rich-text-content" style={styles.replyText} dangerouslySetInnerHTML={{ __html: reply.text }} />
                  </div>
                </div>
              ))}

              <div style={styles.replyComposer}>
                <div style={styles.replyAvatar}>Me</div>
                <div style={styles.replyInputContainer}>
                  <RichTextEditor
                    value={replyText[msg.id] || ''}
                    onChange={(val) => setReplyText(prev => ({ ...prev, [msg.id]: val }))}
                    users={allUsers}
                    minHeight="60px"
                    placeholder="Write a reply..."
                  />
                  <button 
                    style={{...styles.submitBtn, padding: '6px 12px', fontSize: '0.85rem'}} 
                    onClick={() => handleSendReply(msg.id)}
                    disabled={!(replyText[msg.id] || '').trim()}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
