import { useState } from 'react'

const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DatePickerPopover({ task, token, coords, onDatesUpdated }) {
  const [calendarView, setCalendarView] = useState({ year: 2026, month: 6 }) // July 2026
  
  const [isRangeMode, setIsRangeMode] = useState(!!task.startDate);
  const [activeInput, setActiveInput] = useState(!!task.startDate ? 'start' : 'end');
  
  const [rangeSelect, setRangeSelect] = useState({
    start: task.startDate ? task.startDate.substring(0, 10) : null,
    end: task.dueDate ? task.dueDate.substring(0, 10) : null
  })

  const [recurrence, setRecurrence] = useState({
    isRecurring: task.isRecurring || false,
    rule: task.recurrenceRule || 'WEEKLY',
    customInterval: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').interval || 1; } catch(e) { return 1; }
    })(),
    customFrequency: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').frequency || 'week'; } catch(e) { return 'week'; }
    })(),
    customDays: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').days || []; } catch(e) { return []; }
    })(),
    monthlyType: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').monthlyType || 'day'; } catch(e) { return 'day'; }
    })(),
    monthlyDay: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').monthlyDay || (task.dueDate ? parseInt(task.dueDate.substring(8, 10)) : 14); } catch(e) { return 14; }
    })(),
    monthlyWeekNum: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').monthlyWeekNum || '1st'; } catch(e) { return '1st'; }
    })(),
    monthlyWeekday: (() => {
        try { return JSON.parse(task.recurrenceCustom || '{}').monthlyWeekday || 1; } catch(e) { return 1; }
    })()
  });
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);

  const generateCalendarDays = (year, month) => {
    const startDay = new Date(year, month, 1).getDay()
    const adjustedStart = startDay === 0 ? 6 : startDay - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    for (let i = 0; i < adjustedStart; i++) { days.push(null) }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ dayNumber: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
    return days
  }

  const handleDayClick = (dateStr) => {
    if (!isRangeMode) {
      setRangeSelect({ start: null, end: dateStr });
    } else {
      if (activeInput === 'start') {
        if (rangeSelect.end && new Date(dateStr) > new Date(rangeSelect.end)) {
          setRangeSelect({ start: dateStr, end: null });
          setActiveInput('end');
        } else {
          setRangeSelect({ ...rangeSelect, start: dateStr });
          setActiveInput('end');
        }
      } else {
        if (rangeSelect.start && new Date(dateStr) < new Date(rangeSelect.start)) {
          setRangeSelect({ start: dateStr, end: null });
          setActiveInput('end');
        } else {
          setRangeSelect({ ...rangeSelect, end: dateStr });
        }
      }
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
            startDate: rangeSelect.start, 
            dueDate: rangeSelect.end,
            isRecurring: recurrence.isRecurring,
            recurrenceRule: recurrence.isRecurring ? recurrence.rule : null,
            recurrenceCustom: recurrence.isRecurring ? JSON.stringify({
                interval: parseInt(recurrence.customInterval) || 1,
                frequency: recurrence.customFrequency,
                days: recurrence.customDays,
                monthlyType: recurrence.monthlyType,
                monthlyDay: recurrence.monthlyDay,
                monthlyWeekNum: recurrence.monthlyWeekNum,
                monthlyWeekday: recurrence.monthlyWeekday
            }) : null
        })
      })
      const updatedTask = await response.json()

      if (!response.ok) {
        alert(updatedTask.error || "Bu işlemi yapmak için yetkiniz yok.");
        return;
      }

      onDatesUpdated(task.id, updatedTask)
    } catch (err) { console.error(err) }
  }

  const handleClear = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ startDate: null, dueDate: null, isRecurring: false })
      })
      const updatedTask = await response.json()

      if (!response.ok) {
        alert(updatedTask.error || "Bu işlemi yapmak için yetkiniz yok.");
        return;
      }

      setRangeSelect({ start: null, end: null })
      onDatesUpdated(task.id, updatedTask)
    } catch (err) { console.error(err) }
  }

  const renderWeeklyOptions = () => (
    <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>On these days</div>
        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'space-between' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, idx) => {
                const jsDayIndex = idx === 6 ? 0 : idx + 1;
                const isSelected = (recurrence.customDays || []).includes(jsDayIndex);
                return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                        <div 
                            onClick={() => {
                                const currentDays = recurrence.customDays || [];
                                const newDays = currentDays.includes(jsDayIndex) 
                                    ? currentDays.filter(d => d !== jsDayIndex)
                                    : [...currentDays, jsDayIndex];
                                setRecurrence({ ...recurrence, customDays: newDays });
                            }}
                            style={{
                                width: '22px', height: '22px', borderRadius: '4px', border: `1px solid ${isSelected ? '#4F46E5' : '#D1D5DB'}`,
                                backgroundColor: isSelected ? '#4F46E5' : 'transparent', boxSizing: 'border-box', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                            }}
                        >
                            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{dayLabel}</span>
                    </div>
                )
            })}
        </div>
    </div>
  );

  const renderMonthlyOptions = () => (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="radio" checked={recurrence.monthlyType === 'weekday'} onChange={() => setRecurrence({...recurrence, monthlyType: 'weekday'})} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>On the</span>
            <select value={recurrence.monthlyWeekNum} onChange={e => setRecurrence({...recurrence, monthlyWeekNum: e.target.value})} style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <option value="1st">1st</option>
                <option value="2nd">2nd</option>
                <option value="3rd">3rd</option>
                <option value="4th">4th</option>
                <option value="last">last</option>
            </select>
            <select value={recurrence.monthlyWeekday} onChange={e => setRecurrence({...recurrence, monthlyWeekday: parseInt(e.target.value)})} style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={0}>Sunday</option>
            </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="radio" checked={recurrence.monthlyType === 'day'} onChange={() => setRecurrence({...recurrence, monthlyType: 'day'})} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>On day</span>
            <select value={recurrence.monthlyDay} onChange={e => setRecurrence({...recurrence, monthlyDay: parseInt(e.target.value)})} style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {[...Array(31)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
            </select>
        </div>
    </div>
  );

  return (
    <div 
      style={{
        ...styles.calendarPopover,
        top: coords.top !== undefined ? `${coords.top}px` : 'auto',   
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
        left: `${coords.left}px`,
        maxHeight: coords.top !== undefined ? `calc(100vh - ${coords.top + 10}px)` : (coords.bottom !== undefined ? `calc(100vh - ${coords.bottom + 10}px)` : '90vh'),
        overflowY: 'auto'
      }} 
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        {!isRangeMode ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }} onClick={() => { setIsRangeMode(true); setActiveInput('start'); }}>
            + Start date
          </div>
        ) : (
          <div style={{ ...styles.popoverInputBox, border: `1px solid ${activeInput === 'start' ? '#4F46E5' : '#D1D5DB'}` }} onClick={() => setActiveInput('start')}>
            <input type="text" readOnly value={rangeSelect.start || 'Start date'} style={styles.hiddenTextInp}/>
            {rangeSelect.start && <span onClick={(e) => { e.stopPropagation(); setRangeSelect({ ...rangeSelect, start: null }); if (!rangeSelect.end) setIsRangeMode(false); }} style={styles.clearInpCross}>×</span>}
          </div>
        )}
        <div style={{ ...styles.popoverInputBox, border: `1px solid ${(!isRangeMode || activeInput === 'end') ? '#4F46E5' : '#D1D5DB'}` }} onClick={() => isRangeMode && setActiveInput('end')}>
          <input type="text" readOnly value={rangeSelect.end || 'Due date'} style={styles.hiddenTextInp}/>
          {rangeSelect.end && <span onClick={(e) => { e.stopPropagation(); setRangeSelect({ ...rangeSelect, end: null }) }} style={styles.clearInpCross}>×</span>}
        </div>
      </div>

      <div style={styles.calendarMonthHeader}>
        <span style={{ cursor: 'pointer' }} onClick={() => setCalendarView({ ...calendarView, month: calendarView.month === 0 ? 11 : calendarView.month - 1 })}>‹</span>
        <span style={{ fontWeight: '600' }}>{monthsList[calendarView.month]} {calendarView.year}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => setCalendarView({ ...calendarView, month: calendarView.month === 11 ? 0 : calendarView.month + 1 })}>›</span>
      </div>

      <div style={styles.calendarWeekGrid}>
        <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
      </div>

      <div style={styles.calendarDaysGrid}>
        {generateCalendarDays(calendarView.year, calendarView.month).map((dayObj, idx) => {
          if (!dayObj) return <div key={`empty-${idx}`}></div>
          const isStart = rangeSelect.start === dayObj.dateStr
          const isEnd = rangeSelect.end === dayObj.dateStr
          const inRange = rangeSelect.start && rangeSelect.end && new Date(dayObj.dateStr) >= new Date(rangeSelect.start) && new Date(dayObj.dateStr) <= new Date(rangeSelect.end)
          
          let isRepeatingDay = false;
          const anchorDateStr = rangeSelect.end || rangeSelect.start;
          if (recurrence.isRecurring && anchorDateStr && !isStart && !isEnd) {
              const currentD = new Date(dayObj.dateStr);
              const anchorD = new Date(anchorDateStr);
              if (currentD > anchorD) {
                  let activeRule = recurrence.rule;
                  let activeFreq = recurrence.customFrequency;
                  let interval = parseInt(recurrence.customInterval) || 1;
                  
                  if (activeRule !== 'CUSTOM') {
                      interval = 1;
                  } else {
                      activeRule = activeFreq.toUpperCase(); // 'DAY', 'WEEK', 'MONTH', 'YEAR'
                  }

                  if (activeRule === 'DAILY' || activeRule === 'DAY') {
                      isRepeatingDay = Math.floor((currentD - anchorD) / 86400000) % interval === 0;
                  } else if (activeRule === 'WEEKLY' || activeRule === 'WEEK') {
                      if ((recurrence.customDays || []).includes(currentD.getDay())) {
                          const cD = new Date(currentD.getTime() - currentD.getDay()*86400000);
                          const aD = new Date(anchorD.getTime() - anchorD.getDay()*86400000);
                          const weeksDiff = Math.round((cD - aD) / (7 * 86400000));
                          isRepeatingDay = weeksDiff % interval === 0;
                      }
                  } else if (activeRule === 'MONTHLY' || activeRule === 'MONTH') {
                      const monthDiff = (currentD.getFullYear() - anchorD.getFullYear()) * 12 + (currentD.getMonth() - anchorD.getMonth());
                      if (monthDiff % interval === 0) {
                          if (recurrence.monthlyType === 'day') {
                              isRepeatingDay = currentD.getDate() === parseInt(recurrence.monthlyDay);
                          } else {
                              if (currentD.getDay() === parseInt(recurrence.monthlyWeekday)) {
                                  const d = currentD.getDate();
                                  if (recurrence.monthlyWeekNum === '1st' && d >= 1 && d <= 7) isRepeatingDay = true;
                                  if (recurrence.monthlyWeekNum === '2nd' && d >= 8 && d <= 14) isRepeatingDay = true;
                                  if (recurrence.monthlyWeekNum === '3rd' && d >= 15 && d <= 21) isRepeatingDay = true;
                                  if (recurrence.monthlyWeekNum === '4th' && d >= 22 && d <= 28) isRepeatingDay = true;
                              }
                          }
                      }
                  } else if (activeRule === 'YEARLY' || activeRule === 'YEAR') {
                      const yearDiff = currentD.getFullYear() - anchorD.getFullYear();
                      if (yearDiff % interval === 0) {
                          isRepeatingDay = currentD.getDate() === anchorD.getDate() && currentD.getMonth() === anchorD.getMonth();
                      }
                  }
              }
          }

          return (
            <div 
              key={dayObj.dateStr}
              onClick={() => handleDayClick(dayObj.dateStr)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: inRange && !isStart && !isEnd ? '#F3F4F6' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <span 
                style={{
                  ...styles.calendarDayCell,
                  backgroundColor: isStart || isEnd ? '#4F46E5' : (isRepeatingDay ? '#DBEAFE' : 'transparent'),
                  color: isStart || isEnd ? '#FFF' : (isRepeatingDay ? '#1E40AF' : 'var(--text-primary)'),
                  borderRadius: (isStart || isEnd || isRepeatingDay) ? '50%' : '4px',
                  width: '28px', height: '28px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {dayObj.dayNumber}
              </span>
            </div>
          )
        })}
      </div>

      {showRecurrenceOptions && recurrence.isRecurring && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Repeats</span>
                <select 
                    value={recurrence.rule} 
                    onChange={e => setRecurrence({ ...recurrence, rule: e.target.value })}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="CUSTOM">Custom</option>
                </select>
            </div>

            {recurrence.rule === 'WEEKLY' && renderWeeklyOptions()}
            {recurrence.rule === 'MONTHLY' && renderMonthlyOptions()}

            {recurrence.rule === 'CUSTOM' && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Every</span>
                        <input 
                            type="number"
                            min="1"
                            value={recurrence.customInterval} 
                            onChange={e => setRecurrence({ ...recurrence, customInterval: e.target.value })}
                            style={{ 
                              width: '44px', border: '1px solid #D1D5DB', borderRadius: '4px', 
                              padding: '0.15rem 0.3rem', fontSize: '0.85rem', color: 'var(--text-primary)', outline: 'none' 
                            }}
                        />
                        <select 
                            value={recurrence.customFrequency} 
                            onChange={e => setRecurrence({ ...recurrence, customFrequency: e.target.value })}
                            style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="day">Day{recurrence.customInterval > 1 ? 's' : ''}</option>
                            <option value="week">Week{recurrence.customInterval > 1 ? 's' : ''}</option>
                            <option value="month">Month{recurrence.customInterval > 1 ? 's' : ''}</option>
                            <option value="year">Year{recurrence.customInterval > 1 ? 's' : ''}</option>
                        </select>
                    </div>

                    {recurrence.customFrequency === 'week' && renderWeeklyOptions()}
                    {recurrence.customFrequency === 'month' && renderMonthlyOptions()}
                </div>
            )}
        </div>
      )}

      <div style={styles.popoverFooterBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </span>
          <div 
            onClick={() => {
              setRecurrence({...recurrence, isRecurring: !recurrence.isRecurring});
              setShowRecurrenceOptions(!recurrence.isRecurring);
            }}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              backgroundColor: recurrence.isRecurring ? '#E0E7FF' : 'transparent',
              color: recurrence.isRecurring ? '#4F46E5' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { if (!recurrence.isRecurring) e.currentTarget.style.backgroundColor = '#F3F4F6' }}
            onMouseLeave={e => { if (!recurrence.isRecurring) e.currentTarget.style.backgroundColor = 'transparent' }}
            title="Toggle Recurrence"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button style={styles.clearDatesBtn} onClick={handleClear}>Clear</button>
          <button style={styles.saveDatesBtn} onClick={handleSave}>Done</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  calendarPopover: { position: 'fixed', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100005, padding: '1rem', width: '260px', boxSizing: 'border-box' },
  popoverInputsRow: { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  popoverInputBox: { flex: 1, height: '36px', backgroundColor: 'var(--bg-secondary)', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '0 0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' },
  hiddenTextInp: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', width: '80%', outline: 'none' },
  clearInpCross: { color: '#9CA3AF', cursor: 'pointer', fontSize: '1.1rem' },
  calendarMonthHeader: { display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.75rem', padding: '0 0.25rem' },
  calendarWeekGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: '600' },
  calendarDaysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '28px', rowGap: '4px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-primary)' },
  calendarDayCell: { userSelect: 'none', fontWeight: '500' },
  popoverFooterBar: { display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' },
  clearDatesBtn: { background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' },
  saveDatesBtn: { background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }
}
