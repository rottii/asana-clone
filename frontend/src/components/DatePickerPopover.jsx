import { useState } from 'react'

const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DatePickerPopover({ task, token, coords, onDatesUpdated }) {
  const [calendarView, setCalendarView] = useState({ year: 2026, month: 6 }) // July 2026
  const [rangeSelect, setRangeSelect] = useState({
    start: task.startDate ? task.startDate.substring(0, 10) : null,
    end: task.dueDate ? task.dueDate.substring(0, 10) : null
  })

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
    if (!rangeSelect.start || (rangeSelect.start && rangeSelect.end)) {
      setRangeSelect({ start: dateStr, end: null })
    } else {
      if (new Date(dateStr) < new Date(rangeSelect.start)) {
        setRangeSelect({ start: dateStr, end: null })
      } else {
        setRangeSelect({ ...rangeSelect, end: dateStr })
      }
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ startDate: rangeSelect.start, dueDate: rangeSelect.end })
      })
      const updatedTask = await response.json()

      // --- KRİTİK YETKİ KONTROLÜ ---
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
        body: JSON.stringify({ startDate: null, dueDate: null })
      })
      const updatedTask = await response.json()

      // --- KRİTİK YETKİ KONTROLÜ ---
      if (!response.ok) {
        alert(updatedTask.error || "Bu işlemi yapmak için yetkiniz yok.");
        return;
      }

      setRangeSelect({ start: null, end: null })
      onDatesUpdated(task.id, updatedTask)
    } catch (err) { console.error(err) }
  }

  return (
    <div 
      style={{
        ...styles.calendarPopover,
        top: coords.top !== undefined ? `${coords.top}px` : 'auto',   
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
        left: `${coords.left}px`
      }} 
      onClick={(e) => e.stopPropagation()}
    >
      <div style={styles.popoverInputsRow}>
        <div style={{ ...styles.popoverInputBox, border: `1px solid ${!rangeSelect.end ? '#4F46E5' : 'var(--text-primary)'}` }}>
          <input type="text" readOnly value={rangeSelect.start || 'GG/AA/YY'} style={styles.hiddenTextInp}/>
          {rangeSelect.start && <span onClick={() => setRangeSelect({ ...rangeSelect, start: null })} style={styles.clearInpCross}>×</span>}
        </div>
        <div style={{ ...styles.popoverInputBox, border: `1px solid ${rangeSelect.start && !rangeSelect.end ? '#4F46E5' : 'var(--text-primary)'}` }}>
          <input type="text" readOnly value={rangeSelect.end || 'GG/AA/YY'} style={styles.hiddenTextInp}/>
          {rangeSelect.end && <span onClick={() => setRangeSelect({ ...rangeSelect, end: null })} style={styles.clearInpCross}>×</span>}
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
          if (!dayObj) return <span key={`empty-${idx}`}></span>
          const isStart = rangeSelect.start === dayObj.dateStr
          const isEnd = rangeSelect.end === dayObj.dateStr
          const inRange = rangeSelect.start && rangeSelect.end && new Date(dayObj.dateStr) >= new Date(rangeSelect.start) && new Date(dayObj.dateStr) <= new Date(rangeSelect.end)

          return (
            <span 
              key={dayObj.dateStr}
              onClick={() => handleDayClick(dayObj.dateStr)}
              style={{
                ...styles.calendarDayCell,
                backgroundColor: isStart || isEnd ? '#4F46E5' : inRange ? '#E0E7FF' : 'transparent',
                color: isStart || isEnd ? '#FFF' : 'var(--text-primary)',
                borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : inRange ? '0' : '4px'
              }}
            >
              {dayObj.dayNumber}
            </span>
          )
        })}
      </div>

      <div style={styles.popoverFooterBar}>
        <button style={styles.clearDatesBtn} onClick={handleClear}>Clear</button>
        <button style={styles.saveDatesBtn} onClick={handleSave}>Done</button>
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
  calendarDaysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: '2px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-primary)' },
  calendarDayCell: { padding: '0.35rem 0', cursor: 'pointer', display: 'block', userSelect: 'none', fontWeight: '500' },
  popoverFooterBar: { display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' },
  clearDatesBtn: { background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' },
  saveDatesBtn: { background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }
}
