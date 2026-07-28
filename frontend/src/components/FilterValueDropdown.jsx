import React, { useState } from 'react';
import DatePickerPopover from './DatePickerPopover';
import AssigneePopover from './AssigneePopover';

export default function FilterValueDropdown({ filter, type, onSelect, project, alignRight = false }) {
  // Common Dropdown Styling
  const popoverStyle = { position: 'absolute', top: '100%', left: alignRight ? 'auto' : 0, right: alignRight ? 0 : 'auto', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 101, marginTop: '4px', padding: '4px 0', minWidth: '150px' };
  const itemStyle = { padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', transition: 'background-color 0.1s' };

  const filterType = (filter.type || '').toLowerCase();
  const isDateField = ['Start date', 'Due date', 'Created on', 'Completed on', 'Last modified on'].includes(filter.field) || filterType === 'date';
  const isAssigneeField = ['Assignee', 'Created by'].includes(filter.field);
  const isMulti = filterType === 'multi_select' || filterType === 'multi-select';
  const isSingle = filterType === 'single_select' || filterType === 'single-select' || filterType === 'select';

  const formatInitialDate = (valStr) => {
    if (!valStr) return null;
    try {
        const d = new Date(valStr);
        if (isNaN(d.getTime())) return null;
        return valStr.substring(0, 10);
    } catch(e) { return null; }
  };

  if (isDateField) {
    const isStart = type === 'value_start';
    const isSingleValue = type === 'value';
    return (
      <DatePickerPopover 
        filterMode={true}
        initialStart={isSingleValue ? formatInitialDate(filter.value) : (isStart ? formatInitialDate(filter.value?.start) : null)}
        initialEnd={(!isSingleValue && !isStart) ? formatInitialDate(filter.value?.end) : null}
        onFilterApply={(range) => {
            const selectedDate = range.start || range.end;
            if (isSingleValue) {
                onSelect(selectedDate);
            } else if (isStart) {
                onSelect({ ...(filter.value || {}), start: selectedDate });
            } else {
                onSelect({ ...(filter.value || {}), end: selectedDate });
            }
        }}
        styleOverrides={{ position: 'absolute', top: '100%', left: alignRight ? 'auto' : 0, right: alignRight ? 0 : 'auto', minWidth: '320px', marginTop: '4px' }}
      />
    );
  }

  if (isAssigneeField) {
    return (
      <AssigneePopover
        project={project}
        filterMode={true}
        onFilterApply={(user) => {
            onSelect(user ? user.name : null);
        }}
        styleOverrides={{ position: 'absolute', top: '100%', left: alignRight ? 'auto' : 0, right: alignRight ? 0 : 'auto', minWidth: '220px', marginTop: '4px' }}
      />
    );
  }

  if (isMulti || isSingle || filterType === 'github_pr') {
    let rawOptions = filter.options;
    if (!rawOptions && project?.customFieldSettings) {
      const parsedFields = typeof project.customFieldSettings === 'string' ? (()=>{try{return JSON.parse(project.customFieldSettings)}catch(e){return []}})() : project.customFieldSettings;
      const cf = Array.isArray(parsedFields) ? parsedFields.find(f => f.title === filter.field) : null;
      if (cf) rawOptions = cf.options;
    }
    rawOptions = rawOptions || [];
    const options = rawOptions.map(opt => typeof opt === 'object' && opt !== null ? (opt.value || opt.label || '') : opt).filter(Boolean);
    return (
      <div style={popoverStyle} onClick={e => e.stopPropagation()}>
        {options.map((opt, i) => {
          const isSelected = isMulti ? (filter.value || []).includes(opt) : filter.value === opt;
          return (
            <div 
              key={i} 
              style={{ ...itemStyle, backgroundColor: isSelected ? '#EEF2F6' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#EEF2F6' : 'transparent'}
              onClick={(e) => {
                e.stopPropagation();
                if (isMulti) {
                    const currentVals = Array.isArray(filter.value) ? [...filter.value] : [];
                    if (isSelected) {
                        onSelect(currentVals.filter(v => v !== opt));
                    } else {
                        onSelect([...currentVals, opt]);
                    }
                } else {
                    onSelect(opt);
                }
              }}
            >
              {isMulti && (
                  <input type="checkbox" checked={isSelected} readOnly style={{ margin: 0 }} />
              )}
              {opt}
            </div>
          )
        })}
      </div>
    );
  }

  if (filter.field === 'Completion status') {
    const options = ['Incomplete', 'Completed'];
    return (
      <div style={popoverStyle} onClick={e => e.stopPropagation()}>
        {options.map(opt => (
          <div 
            key={opt}
            style={{ ...itemStyle, backgroundColor: filter.value === opt ? '#EEF2F6' : 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = filter.value === opt ? '#EEF2F6' : 'transparent'}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </div>
        ))}
      </div>
    );
  }

  if (filter.field === 'Task type') {
    const options = ['Task', 'Milestone', 'Approval'];
    return (
      <div style={popoverStyle} onClick={e => e.stopPropagation()}>
        {options.map(opt => (
          <div 
            key={opt}
            style={{ ...itemStyle, backgroundColor: filter.value === opt ? '#EEF2F6' : 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = filter.value === opt ? '#EEF2F6' : 'transparent'}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
