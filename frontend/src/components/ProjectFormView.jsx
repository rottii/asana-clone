import React, { useState, useEffect } from 'react';

export default function ProjectFormView({ project, token, onProjectUpdate, onClose, activeFormId }) {
  const [formSettings, setFormSettings] = useState({
    id: Date.now().toString(),
    isActive: true,
    title: project.name || 'Form',
    description: 'Add form description',
    questions: [
      { id: 'q-name', title: 'Name', type: 'TEXT', customFieldId: null, required: true },
      { id: 'q-email', title: 'Email address', type: 'TEXT', customFieldId: null, required: true }
    ]
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('Questions');

  useEffect(() => {
    if (project.formSettings) {
      const formsArray = Array.isArray(project.formSettings) ? project.formSettings : [project.formSettings];
      const existing = formsArray.find(f => f.id === activeFormId);
      if (existing) {
        setFormSettings(existing);
      }
    }
  }, [project.formSettings, activeFormId]);

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      const formsArray = Array.isArray(project.formSettings) ? project.formSettings : (project.formSettings ? [project.formSettings] : []);
      const existingIndex = formsArray.findIndex(f => f.id === formSettings.id);

      let newFormsArray;
      if (existingIndex >= 0) {
        newFormsArray = [...formsArray];
        newFormsArray[existingIndex] = formSettings;
      } else {
        newFormsArray = [...formsArray, formSettings];
      }

      const response = await fetch(`http://localhost:5001/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ formSettings: newFormsArray })
      });
      const data = await response.json();
      if (response.ok) {
        onProjectUpdate(data);
        if (onClose) onClose();
      } else {
        alert(data.error || 'Failed to publish form');
      }
    } catch (err) {
      console.error(err);
    }
    setIsSaving(false);
  };

  const addQuestion = (type, label = 'New question', customFieldId = null) => {
    const newSettings = {
      ...formSettings,
      questions: [
        ...formSettings.questions,
        { id: Date.now().toString(), title: label, type, customFieldId, required: false }
      ]
    };
    setFormSettings(newSettings);
  };

  const updateQuestion = (id, updates) => {
    setFormSettings({
      ...formSettings,
      questions: formSettings.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    });
  };

  const removeQuestion = (id) => {
    setFormSettings({
      ...formSettings,
      questions: formSettings.questions.filter(q => q.id !== id)
    });
  };

  const publicLink = `${window.location.origin}/form/${project.id}/${formSettings.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicLink);
    alert('Public link copied to clipboard!');
  };

  const openPublicForm = () => {
    window.open(publicLink, '_blank');
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>Add form</div>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* SUB-HEADER ACTION BAR */}
      <div style={styles.actionBar}>
        <div style={styles.actionLeft}>
          <span style={styles.docIcon}>📄</span>
          <span style={styles.actionText}>Only your organization can access and submit the form. <span style={styles.actionLink}>Change</span></span>
        </div>
        <div style={styles.actionRight}>
          <button style={styles.iconBtn} onClick={openPublicForm}><span>★</span> View form</button>
          <button style={styles.iconBtn}><span>⎘</span> Share form</button>
          <button style={styles.iconBtn} onClick={copyToClipboard}><span>🔗</span> Copy link</button>
          <button style={{ ...styles.iconBtn, padding: '0.2rem 0.5rem' }}>•••</button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={styles.mainArea}>

        {/* LEFT CANVAS */}
        <div style={styles.canvasContainer}>
          <div style={styles.canvasContent}>

            {/* Cover Image Block */}
            <div style={styles.coverImageBlock}>
              <button style={styles.addCoverBtn}>Add cover image</button>
            </div>

            {/* Title & Description Block */}
            <div style={styles.cardBlock}>
              <input
                style={styles.titleInput}
                value={formSettings.title}
                onChange={e => setFormSettings({ ...formSettings, title: e.target.value })}
                placeholder="Form Title"
              />
              <textarea
                style={styles.descInput}
                value={formSettings.description}
                onChange={e => setFormSettings({ ...formSettings, description: e.target.value })}
                placeholder="Add form description"
              />
            </div>

            {/* Question Blocks */}
            {formSettings.questions.map((q, index) => (
              <div key={q.id} style={styles.questionCard}>
                <div style={styles.questionHeader}>
                  <div style={styles.questionTitleWrapper}>
                    <input
                      style={styles.questionTitleInput}
                      value={q.title}
                      onChange={e => updateQuestion(q.id, { title: e.target.value })}
                    />
                    {q.required && <span style={styles.requiredStar}>*</span>}
                  </div>
                  <button style={styles.removeQuestionBtn} onClick={() => removeQuestion(q.id)}>✕</button>
                </div>

                {q.type === 'PARAGRAPH' ? (
                  <div style={{ ...styles.mockTextarea, padding: '0.5rem', color: '#9CA3AF', fontFamily: 'inherit' }}>Enter your response...</div>
                ) : (
                  <div style={{ ...styles.mockInput, padding: '0 0.5rem', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>Enter your response...</div>
                )}
              </div>
            ))}

            {/* Dropzone Placeholder */}
            <div style={styles.dropzone}>
              Drag another question here
            </div>

          </div>
        </div>

        {/* RIGHT TOOLKIT */}
        <div style={styles.toolkitContainer}>
          <div style={styles.toolkitCard}>
            <div style={styles.tabsHeader}>
              <div
                style={activeTab === 'Questions' ? styles.tabActive : styles.tabInactive}
                onClick={() => setActiveTab('Questions')}
              >
                Questions
              </div>
              <div
                style={activeTab === 'Settings' ? styles.tabActive : styles.tabInactive}
                onClick={() => setActiveTab('Settings')}
              >
                Settings
              </div>
            </div>

            {activeTab === 'Questions' && (
              <div style={styles.toolkitBody}>
                {/* Custom Fields Accordion (Mocked as button) */}
                <button style={styles.toolkitBtnItem} onClick={() => addQuestion('CUSTOM_FIELD', 'New Custom Field')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>◇</span> Fields
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{project.customFieldSettings?.length || 0} ›</span>
                </button>

                <button style={styles.toolkitBtnItem} onClick={() => addQuestion('TEXT', 'Email address')}>
                  <span style={{ color: 'var(--text-secondary)' }}>✉</span> Email address
                </button>

                <button style={styles.toolkitBtnItem} onClick={() => addQuestion('TEXT', 'Attachment')}>
                  <span style={{ color: 'var(--text-secondary)' }}>📎</span> Attachment
                </button>

                <button style={styles.toolkitBtnItem} onClick={() => addQuestion('TEXT', 'Heading')}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>H1</span> Heading
                </button>

                <button style={styles.toolkitBtnNew} onClick={() => addQuestion('TEXT', 'New question')}>
                  + New question
                </button>
              </div>
            )}

            {activeTab === 'Settings' && (
              <div style={styles.toolkitBody}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 0 }}>Form settings go here.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          <button style={styles.discardBtn} onClick={onClose}>Discard form</button>
        </div>
        <div style={styles.footerRight}>
          <button style={styles.publishBtn} onClick={handlePublish} disabled={isSaving}>
            {isSaving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: '#F9F9F9',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E5E7EB'
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: '500',
    color: 'var(--text-primary)'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: 'var(--text-secondary)'
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E5E7EB',
    fontSize: '0.85rem'
  },
  actionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--text-primary)'
  },
  docIcon: {
    color: 'var(--text-secondary)'
  },
  actionLink: {
    color: '#2563EB',
    cursor: 'pointer'
  },
  actionRight: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '500'
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative'
  },
  canvasContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    justifyContent: 'center'
  },
  canvasContent: {
    width: '100%',
    maxWidth: '650px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  },
  coverImageBlock: {
    width: '100%',
    height: '140px',
    backgroundColor: '#E5E7EB',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '-0.5rem'
  },
  addCoverBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    color: 'var(--text-primary)'
  },
  cardBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  titleInput: {
    fontSize: '1.5rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    border: 'none',
    outline: 'none',
    width: '100%',
    padding: '0'
  },
  descInput: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    border: 'none',
    outline: 'none',
    width: '100%',
    minHeight: '40px',
    resize: 'none',
    padding: '0',
    fontFamily: 'inherit'
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  questionTitleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem',
    flex: 1
  },
  questionTitleInput: {
    fontSize: '0.95rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    border: 'none',
    outline: 'none',
    flex: 1
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: 'bold',
    marginLeft: '2px'
  },
  removeQuestionBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'color 0.2s'
  },
  mockInput: {
    width: '100%',
    height: '40px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF'
  },
  mockTextarea: {
    width: '100%',
    height: '80px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF'
  },
  dropzone: {
    width: '100%',
    padding: '2rem 1rem',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '8px',
    color: '#2563EB',
    textAlign: 'center',
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  toolkitContainer: {
    width: '320px',
    padding: '2rem 2rem 2rem 0',
    overflowY: 'auto'
  },
  toolkitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column'
  },
  tabsHeader: {
    display: 'flex',
    borderBottom: '1px solid #E5E7EB'
  },
  tabActive: {
    flex: 1,
    textAlign: 'center',
    padding: '1rem 0',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--text-primary)827',
    cursor: 'pointer'
  },
  tabInactive: {
    flex: 1,
    textAlign: 'center',
    padding: '1rem 0',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    borderBottom: '2px solid transparent',
    cursor: 'pointer'
  },
  toolkitBody: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  toolkitBtnItem: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left'
  },
  toolkitBtnNew: {
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    marginTop: '0.5rem'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#FFFFFF',
    borderTop: '1px solid #E5E7EB'
  },
  footerLeft: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  discardBtn: {
    background: 'none',
    border: '1px solid #FCA5A5',
    color: '#DC2626',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    backgroundColor: '#FEF2F2'
  },
  feedbackBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  footerRight: {
    display: 'flex'
  },
  publishBtn: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    padding: '0.6rem 1.5rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer'
  }
};
