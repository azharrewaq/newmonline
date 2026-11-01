import React, { useMemo, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { isPlatformManager } from '../utils/announcementHelpers';

function PlatformHolidays() {
  const { holidays = [], addHoliday, deleteHoliday } = useAppData();
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const [form, setForm] = useState({ name: '', from: '', to: '' });

  if (!isPlatformManager(currentUser)) {
    return (
      <div className="management-page" style={{ display: 'flex', justifyContent: 'center', minHeight: 300, alignItems: 'center' }}>
        <div className="box-card" style={{ padding: 40, textAlign: 'center' }}>
          <h3 style={{ color: '#ef4444' }}>عذراً، هذه الصفحة للإدارة فقط</h3>
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    if (!form.from) { alert('يرجى تحديد تاريخ بداية الإجازة'); return; }
    const to = form.to || form.from;
    if (to < form.from) { alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية'); return; }
    addHoliday({ name: form.name.trim(), from: form.from, to });
    setForm({ name: '', from: '', to: '' });
  };

  const sorted = [...holidays].sort((a, b) => String(b.from).localeCompare(String(a.from)));

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="title-section">
          <h2><CalendarOff size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />إجازات المنصة</h2>
          <p>الأيام المحددة هنا تُعتبر إجازة لجميع الحلقات: لا تُدرج فيها تقارير ولا يُفعَّل الدخول للحلقات</p>
        </div>
      </div>

      <div className="box-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label>اسم الإجازة (اختياري)</label>
            <input className="form-input" placeholder="مثال: إجازة عيد الفطر" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>من تاريخ</label>
            <input type="date" className="form-input" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} />
          </div>
          <div className="form-group">
            <label>إلى تاريخ</label>
            <input type="date" className="form-input" min={form.from} value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> إضافة</button>
        </div>
      </div>

      <div className="table-wrapper box-card">
        <table className="management-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>الاسم</th>
              <th style={{ textAlign: 'center' }}>من</th>
              <th style={{ textAlign: 'center' }}>إلى</th>
              <th style={{ textAlign: 'center' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>لا توجد إجازات مسجلة.</td></tr>
            ) : sorted.map(h => (
              <tr key={h.id}>
                <td style={{ textAlign: 'center' }}>{h.name || '-'}</td>
                <td style={{ textAlign: 'center', direction: 'ltr' }}>{h.from}</td>
                <td style={{ textAlign: 'center', direction: 'ltr' }}>{h.to}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="action-icon delete" onClick={() => deleteHoliday(h.id)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlatformHolidays;
