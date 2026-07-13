import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function AddFieldModal({ onClose, onCreateField, onUpdateField, editField }) {
  const [activeTab, setActiveTab] = useState('create') // 'create' | 'library' | 'ai'
  const [fieldTitle, setFieldTitle] = useState(editField ? editField.title : '')
  const [fieldType, setFieldType] = useState('Single-select')
  
  const [options, setOptions] = useState(
    editField && editField.options && editField.options.length > 0 
      ? editField.options.map(opt => ({ id: opt.id, value: opt.label, color: opt.color || '#E0E7FF' }))
      : [
          { id: 1, value: '', color: '#10B981' },
          { id: 2, value: '', color: '#EF4444' }
        ]
  )

  const handleAddOption = () => {
    const randomColors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981']
    const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)]
    setOptions([...options, { id: Date.now(), value: '', color: randomColor }])
  }

  const handleOptionChange = (id, text) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, value: text } : opt))
  }

  const handleOptionColorChange = (id, newColor) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, color: newColor } : opt))
  }

  const handleRemoveOption = (id) => {
    if (options.length > 1) {
      setOptions(options.filter(opt => opt.id !== id))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!fieldTitle.trim()) return

    const defaultValue = options[0]?.value || '—'
    
    const mappedOptions = options.filter(o => o.value.trim() !== '').map(o => ({
      id: o.id.toString(),
      label: o.value.trim(),
      color: o.color
    }));
    
    if (editField && onUpdateField) {
      onUpdateField({ ...editField, title: fieldTitle.trim(), options: mappedOptions })
    } else {
      onCreateField(fieldTitle.trim(), defaultValue, mappedOptions)
    }
  }

  return createPortal(
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{editField ? 'Edit field' : 'Add field'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="button" style={styles.manageAccessBtn}>👥 Manage access</button>
            <button type="button" onClick={onClose} style={styles.closeXBtn}>×</button>
          </div>
        </div>

        <div style={styles.tabsRow}>
          <span 
            onClick={() => setActiveTab('create')} 
            style={{ ...styles.tabItem, ...(activeTab === 'create' ? styles.activeTabItem : {}) }}
          >
            Create new
          </span>
          <span 
            onClick={() => setActiveTab('library')} 
            style={{ ...styles.tabItem, ...(activeTab === 'library' ? styles.activeTabItem : {}) }}
          >
            Choose from library
          </span>
          <span 
            onClick={() => setActiveTab('ai')} 
            style={{ ...styles.tabItem, ...(activeTab === 'ai' ? styles.activeTabItem : {}) }}
          >
            Fields with AI Studio
          </span>
        </div>

        <form onSubmit={handleSubmit} style={styles.formBody}>
          <div style={styles.inputGridRow}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Field title <span style={{ color: '#EF4444' }}>*</span></label>
              <input 
                type="text" 
                placeholder="Priority, Stage, Status..." 
                value={fieldTitle}
                onChange={e => setFieldTitle(e.target.value)}
                style={styles.mainInput}
                required
              />
            </div>
            <div style={{ width: '180px' }}>
              <label style={styles.fieldLabel}>Field type</label>
              <select 
                value={fieldType} 
                onChange={e => setFieldType(e.target.value)}
                style={styles.mainSelect}
              >
                <option value="Single-select">v Single-select</option>
                <option value="Text">📝 Text</option>
                <option value="Number">🔢 Number</option>
              </select>
            </div>
          </div>

          <button type="button" style={styles.addDescTextLink}>+ Add description</button>

          {fieldType === 'Single-select' && (
            <div style={{ marginTop: '1.25rem' }}>
              <label style={styles.fieldLabel}>Options <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={styles.optionsListContainer}>
                {options.map((option, index) => (
                  <div key={option.id} style={styles.optionInputRow}>
                    <input 
                      type="color"
                      value={option.color}
                      onChange={(e) => handleOptionColorChange(option.id, e.target.value)}
                      style={{ width: 24, height: 24, border: 'none', padding: 0, backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      title="Choose color"
                    />
                    <input 
                      type="text" 
                      placeholder="Type an option name" 
                      value={option.value}
                      onChange={e => handleOptionChange(option.id, e.target.value)}
                      style={styles.optionInputField}
                      required={index < 2}
                    />
                    <span onClick={() => handleRemoveOption(option.id)} style={styles.removeOptionCross}>×</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleAddOption} style={styles.addOptionTextBtn}>
                + Add an option
              </button>
            </div>
          )}

          <div style={styles.checkboxesBlock}>
            <label style={styles.checkboxLabel}>
              <input type="checkbox" style={styles.checkboxInp} />
              Add to My workspace's field library
            </label>
            <label style={styles.checkboxLabel}>
              <input type="checkbox" style={styles.checkboxInp} />
              Notify collaborators when this field's value is changed
            </label>
          </div>

          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelFooterBtn}>Cancel</button>
            <button type="submit" style={styles.createFieldFooterBtn}>{editField ? 'Update field' : 'Create field'}</button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}

const styles = {
  backdrop: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 },
  modalBox: { backgroundColor: 'var(--bg-primary)', width: '520px', maxWidth: '90%', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', padding: '1.5rem', boxSizing: 'border-box', fontFamily: 'system-ui' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  modalTitle: { margin: 0, fontSize: '1.4rem', fontWeight: '600', color: 'var(--text-primary)' },
  manageAccessBtn: { background: 'none', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '500' },
  closeXBtn: { background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, lineHeight: 1 },
  tabsRow: { display: 'flex', gap: '1.25rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem', marginBottom: '1.25rem' },
  tabItem: { fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', position: 'relative' },
  activeTabItem: { color: '#4F46E5', fontWeight: '600', borderBottom: '2px solid #4F46E5' },
  formBody: { display: 'flex', flexDirection: 'column' },
  inputGridRow: { display: 'flex', gap: '1rem', marginBottom: '0.75rem' },
  fieldLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' },
  mainInput: { width: '100%', padding: '0.55rem', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' },
  mainSelect: { width: '100%', padding: '0.55rem', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', backgroundColor: 'var(--bg-primary)', outline: 'none', cursor: 'pointer' },
  addDescTextLink: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', padding: 0, fontWeight: '500' },
  optionsListContainer: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' },
  optionInputRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  colorDot: { width: '20px', height: '20px', borderRadius: '50%', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', userSelect: 'none' },
  optionInputField: { flex: 1, border: 'none', borderBottom: '1px solid #E5E7EB', padding: '0.3rem 0', fontSize: '0.85rem', outline: 'none', color: 'var(--text-primary)' },
  removeOptionCross: { cursor: 'pointer', color: '#9CA3AF', fontSize: '1.1rem', padding: '0 0.25rem' },
  addOptionTextBtn: { background: 'none', border: 'none', color: '#4F46E5', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600', padding: 0, marginTop: '0.5rem', textAlign: 'left' },
  checkboxesBlock: { marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' },
  checkboxInp: { width: '15px', height: '15px', cursor: 'pointer' },
  modalFooter: { borderTop: '1px solid #E5E7EB', marginTop: '1.5rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' },
  cancelFooterBtn: { backgroundColor: 'transparent', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' },
  createFieldFooterBtn: { backgroundColor: '#4F46E5', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '#FFF', fontWeight: '600', color: '#FFF', cursor: 'pointer' }
}
