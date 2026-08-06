import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export default function PublicForm() {
  const [project, setProject] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [activeFormSettings, setActiveFormSettings] = useState(null);

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const projectId = pathParts[1];
  const formId = pathParts[2];

  useEffect(() => {
    document.body.style.backgroundColor = 'var(--bg-secondary)'; // Standard form bg
    apiFetch(`/api/projects/${projectId}/form`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setProject(data);
          const forms = Array.isArray(data.formSettings) ? data.formSettings : (data.formSettings ? [data.formSettings] : []);
          let selectedForm = forms.find(f => f.id === formId);
          if (!selectedForm && forms.length > 0) {
            selectedForm = forms[0];
          }
          if (selectedForm) {
            setActiveFormSettings(selectedForm);
          } else {
            setError('Form not found');
          }
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load form');
        setLoading(false);
      });
  }, [projectId]);

  const handleChange = (questionId, value) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let title = 'Form Submission';
    let description = '';
    const customFields = {};

    activeFormSettings.questions.forEach(q => {
      const answer = formData[q.id] || '';
      if (q.type === 'TEXT') {
        title = answer || title;
      } else if (q.type === 'PARAGRAPH') {
        description += `**${q.title}**\n${answer}\n\n`;
      } else if (q.type === 'CUSTOM_FIELD' && q.customFieldId) {
        customFields[q.customFieldId] = answer;
      }
    });

    try {
      const response = await apiFetch(`/api/projects/${projectId}/form/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, customFields })
      });
      if (response.ok) {
        setSuccess(true);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to submit form');
      }
    } catch (err) {
      setError('An error occurred while submitting.');
    }
    setLoading(false);
  };

  if (loading && !project) return <div style={styles.centerMessage}>Loading form...</div>;
  if (error) return <div style={styles.centerMessage}>{error}</div>;
  if (success) return (
    <div style={styles.container}>
      <div style={styles.successCard}>
        <div style={styles.successIcon}>✓</div>
        <h2 style={styles.successTitle}>Request Submitted</h2>
        <p style={styles.successSubtitle}>Thanks for reaching out. Your request has been logged successfully.</p>
      </div>
    </div>
  );

  const formSettings = activeFormSettings || {};

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.formCard}>
        <h1 style={styles.formTitle}>{formSettings.title}</h1>
        <p style={styles.formDescription}>{formSettings.description}</p>
        
        {formSettings.questions?.map(q => (
          <div key={q.id} style={styles.questionBlock}>
            <label style={styles.label}>
              {q.title} {q.required && <span style={{color: 'var(--accent-danger)'}}>*</span>}
            </label>
            {q.type === 'PARAGRAPH' ? (
              <textarea 
                style={styles.textarea}
                required={q.required}
                value={formData[q.id] || ''}
                onChange={e => handleChange(q.id, e.target.value)}
              />
            ) : q.type === 'CUSTOM_FIELD' ? (
              <select 
                style={styles.select}
                required={q.required}
                value={formData[q.id] || ''}
                onChange={e => handleChange(q.id, e.target.value)}
              >
                <option value="">Select an option...</option>
                {project.customFieldSettings?.find(cf => cf.id === q.customFieldId)?.options?.map(opt => (
                  <option key={opt.id} value={opt.label || opt.value}>{opt.label || opt.value}</option>
                ))}
              </select>
            ) : (
              <input 
                style={styles.input}
                type="text"
                required={q.required}
                value={formData[q.id] || ''}
                onChange={e => handleChange(q.id, e.target.value)}
              />
            )}
          </div>
        ))}
        
        <button type="submit" disabled={loading} style={styles.submitBtn}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  centerMessage: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)', fontSize: '1.2rem', fontFamily: 'system-ui' },
  container: { display: 'flex', justifyContent: 'center', padding: '4rem 1rem', minHeight: '100vh', boxSizing: 'border-box', fontFamily: 'system-ui' },
  formCard: { backgroundColor: 'var(--bg-primary)', padding: '3rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '600px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' },
  formTitle: { margin: 0, fontSize: '2rem', color: 'var(--text-primary)', fontWeight: '700', letterSpacing: '-0.02em' },
  formDescription: { margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.5' },
  questionBlock: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' },
  input: { padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' },
  textarea: { padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', minHeight: '120px', fontFamily: 'inherit', resize: 'vertical' },
  select: { padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', cursor: 'pointer' },
  submitBtn: { marginTop: '1rem', padding: '1rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent-primary)', color: '#FFF', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' },
  successCard: { backgroundColor: 'var(--bg-primary)', padding: '4rem 3rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid var(--border-color)', width: '100%', maxWidth: '500px' },
  successIcon: { width: '64px', height: '64px', backgroundColor: 'var(--accent-success)', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', margin: '0 auto 1.5rem', fontWeight: 'bold' },
  successTitle: { margin: '0 0 0.5rem', color: 'var(--text-primary)', fontSize: '1.5rem' },
  successSubtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }
};
