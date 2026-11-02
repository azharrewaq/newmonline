import React, { useMemo, useState } from 'react';
import { X, Trash2, UserCheck } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { toLocalDateStr } from '../utils/sessionHelpers';
import { normalizeArabic } from '../utils/userScopeHelper';

/**
 * تعيين محفظ بديل لحلقة في يوم محدد (عند اعتذار المحفظ الأصلي).
 * البديل قد يكون من محفظي نفس المنسق أو من محفظي منسق آخر.
 */
function SubstituteModal({ session, onClose }) {
  const { platformMohfezs = [], platformSessions = [], substitutions = [], addSubstitution, deleteSubstitution } = useAppData();
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const today = toLocalDateStr();
  const [date, setDate] = useState(today);
  const [mohfezId, setMohfezId] = useState('');
  const [reason, setReason] = useState('');

  // المنسقون المسؤولون عن كل محفظ (مستنتجون من الحلقات التي يدرّسها)
  const coordsOfMohfez = useMemo(() => {
    const map = {};
    platformSessions.forEach(s => {
      if (!s.mohfez || !s.coordinator) return;
      const k = normalizeArabic(s.mohfez);
      (map[k] = map[k] || new Set()).add(s.coordinator);
    });
    return map;
  }, [platformSessions]);

  const sessionCoord = normalizeArabic(session.coordinator || '');
  const candidates = platformMohfezs
    .filter(m => normalizeArabic(m.name) !== normalizeArabic(session.mohfez))
    .map(m => {
      const coords = Array.from(coordsOfMohfez[normalizeArabic(m.name)] || []);
      const sameCoord = coords.some(c => normalizeArabic(c) === sessionCoord);
      return { m, coords, sameCoord };
    });
  const mine = candidates.filter(c => c.sameCoord);
  const others = candidates.filter(c => !c.sameCoord);
  const label = ({ m, coords }) => `${m.name}${coords.length ? ` — منسق: ${coords.join('، ')}` : ''}`;

  const sessionSubs = substitutions
    .filter(s => String(s.sessionId) === String(session.id))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const handleSave = () => {
    if (!date) { alert('يرجى تحديد التاريخ'); return; }
    if (date < today) { alert('لا يمكن تعيين بديل لتاريخ سابق'); return; }
    const chosen = platformMohfezs.find(m => String(m.id) === String(mohfezId));
    if (!chosen) { alert('يرجى اختيار المحفظ البديل'); return; }
    addSubstitution({
      sessionId: String(session.id),
      sessionNo: session.session_no,
      date,
      originalMohfez: session.mohfez || '',
      substituteName: chosen.name,
      substituteNationalId: chosen.national_id || '',
      substituteCoordinators: (coordsOfMohfez[normalizeArabic(chosen.name)] ? Array.from(coordsOfMohfez[normalizeArabic(chosen.name)]) : []),
      reason: reason.trim(),
      createdBy: currentUser?.name || ''
    });
    setMohfezId(''); setReason('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="box-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={18} /> محفظ بديل — حلقة {session.session_no}
          </h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          المحفظ الأصلي: <strong>{session.mohfez || '-'}</strong> — يحل البديل محله في اليوم المحدد فقط (دخول الحلقة، الحضور، التقرير، وساعات المحفظ).
        </p>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>يوم الاعتذار</label>
          <input type="date" className="form-input" min={today} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>المحفظ البديل</label>
          <select className="form-select" value={mohfezId} onChange={e => setMohfezId(e.target.value)}>
            <option value="">--- اختر المحفظ البديل ---</option>
            {mine.length > 0 && (
              <optgroup label="من محفظي نفس المنسق">
                {mine.map(c => <option key={c.m.id} value={c.m.id}>{label(c)}</option>)}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="من محفظي منسقين آخرين / بدون منسق">
                {others.map(c => <option key={c.m.id} value={c.m.id}>{label(c)}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>سبب الاعتذار (اختياري)</label>
          <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={handleSave}>تعيين البديل</button>

        {sessionSubs.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>البدلاء المعيّنون لهذه الحلقة</h4>
            {sessionSubs.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                <span>
                  <strong style={{ direction: 'ltr', display: 'inline-block' }}>{s.date}</strong> — {s.substituteName}
                  {s.substituteCoordinators?.length ? ` (منسق: ${s.substituteCoordinators.join('، ')})` : ''}
                  {s.reason ? ` — ${s.reason}` : ''}
                </span>
                <button className="action-icon delete" title="إلغاء البديل" onClick={() => deleteSubstitution(s.id)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubstituteModal;

