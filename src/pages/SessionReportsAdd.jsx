import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { quranSurahs } from '../data/quranSurahs';
import { isUserAllowedSession } from '../utils/userScopeHelper';
import { getHolidayForDate, getNextSessionNumber } from '../utils/sessionHelpers';
import { isPlatformManager } from '../utils/announcementHelpers';

import { getCurriculumData, normalizeArabicSimple as normalizeArabic } from '../utils/curriculumHelper';


const getArabicDayName = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[d.getDay()];
};

function SessionReportsAdd() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPlatform = location.pathname.startsWith('/platform-sessions');
  const { 
    sessions, 
    platformSessions, 
    sessionReports, 
    addSessionReport, 
    hasPermission,
    platformCoordinators = [],
    platformMohfezs = [],
    platformStudents = [],
    users = [],
    holidays = []
  } = useAppData();
  
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser ? currentUser.role : 'admin';
  const isSuperAdmin = role === 'admin';
  const isStudent = role === 'student' || role === 'sharia_student';
  
  const sessionId = id;
  const session = isPlatform
    ? platformSessions.find(s => String(s.id) === String(id))
    : sessions.find(s => String(s.id) === String(id));

  const isAllowed = isSuperAdmin || (
    !isStudent && 
    hasPermission('reports', 'add') && 
    session && 
    isUserAllowedSession(session, currentUser, { platformCoordinators, platformMohfezs, platformStudents, users })
  );

  const getLocalDateString = (offsetHours = 0) => {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getLocalDateString(0));
  const [sessionNum, setSessionNum] = useState('');

  // Sections State
  const [memorization, setMemorization] = useState({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
  const [review, setReview] = useState({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
  const [recentReview, setRecentReview] = useState({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
  const [distantReview, setDistantReview] = useState({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });

  const isLevelOneChild = (session?.rowaq?.includes('اطفال') || session?.rowaq?.includes('أطفال')) && (normalizeArabic(session?.level) === 'الاول');
  const curriculumData = getCurriculumData(session?.rowaq, session?.level);

  const selectedDayName = getArabicDayName(date);
  const sessionWorkDays = session?.workDays || [];
  const isInvalidDay = date && sessionWorkDays.length > 0 && !sessionWorkDays.includes(selectedDayName);
  const holiday = isPlatform ? getHolidayForDate(date, holidays) : null;

  const emptySection = { fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' };
  const applySessionNumber = (val) => {
    setSessionNum(val);
    if (val && curriculumData) {
      const cur = curriculumData.find(c => c.session === parseInt(val));
      if (cur) {
        setMemorization({ ...cur.memorization });
        setReview({ ...cur.review });
        setRecentReview({ ...cur.recentReview });
        setDistantReview(cur.distantReview ? { ...cur.distantReview } : { ...emptySection });
        return;
      }
    }
    setMemorization({ ...emptySection });
    setReview({ ...emptySection });
    setRecentReview({ ...emptySection });
    setDistantReview({ ...emptySection });
  };

  // ترقيم ديناميكي: يبدأ من رقم جلسة البدء الذي حدده الأدمن ثم يزيد حسب ترتيب التقارير
  const canOverrideSessionNum = isPlatformManager(currentUser);
  const autoSessionNum = isPlatform && session ? String(getNextSessionNumber(session, sessionReports, true)) : '';
  const autoAppliedFor = useRef(null);
  useEffect(() => {
    if (!isPlatform || !session || !autoSessionNum) return;
    const key = `${session.id}:${autoSessionNum}`;
    if (autoAppliedFor.current === key) return;
    autoAppliedFor.current = key;
    applySessionNumber(autoSessionNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatform, session?.id, autoSessionNum, curriculumData]);

  const handleSave = () => {
    if (!date) {
      alert('يرجى اختيار التاريخ');
      return;
    }

    // 0. منع التقارير في أيام الإجازات
    if (holiday) {
      alert(`لا يمكن تسجيل تقرير في يوم إجازة${holiday.name ? ` (${holiday.name})` : ''}`);
      return;
    }

    // 1. Prevent duplicate reports on the same day
    const isDuplicate = (sessionReports || []).some(r => 
      String(r.sessionId) === String(sessionId) && 
      r.date === date &&
      !!r.isPlatform === !!isPlatform
    );
    if (isDuplicate) {
      alert('تم تسجيل تقرير لهذه الحلقة في هذا اليوم بالفعل!');
      return;
    }

    // 1.1 Prevent duplicate reports for the same session number
    if (sessionNum) {
      const isDuplicateSessionNum = (sessionReports || []).some(r => 
        String(r.sessionId) === String(sessionId) && 
        String(r.sessionNum || '').trim() === String(sessionNum).trim() &&
        !!r.isPlatform === !!isPlatform
      );
      if (isDuplicateSessionNum) {
        alert('تم تسجيل تقرير لهذه الجلسة لهذه الحلقة بالفعل!');
        return;
      }
    }

    // 2. Validate session working days
    if (isInvalidDay) {
      alert(`تاريخ التقرير لا يوافق أيام عمل الحلقة. أيام عمل الحلقة هي: ${sessionWorkDays.join('، ')} (اليوم المختار: ${selectedDayName})`);
      return;
    }
    
    addSessionReport({
      sessionId,
      isPlatform,
      date,
      sessionNum,
      memorization,
      review,
      recentReview,
      distantReview
    });
    
    alert('تم حفظ التقرير بنجاح');
    navigate(isPlatform ? `/platform-sessions/${sessionId}/reports` : `/sessions/${sessionId}/reports`);
  };

  const renderSectionFields = (title, state, setState, isRequired = false) => {
    const handleChange = (field, value) => {
      setState(prev => ({ ...prev, [field]: value }));
    };

    // Calculate max ayahs for the selected surahs
    const fromSurahData = quranSurahs.find(s => s.name === state.fromSurah);
    const toSurahData = quranSurahs.find(s => s.name === state.toSurah);
    
    const maxFromAyahs = fromSurahData ? fromSurahData.ayahs : 0;
    const maxToAyahs = toSurahData ? toSurahData.ayahs : 0;

    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '15px' }}>
        <div style={{ width: '200px', fontWeight: 'bold' }}>
          {title} {isRequired && <span className="req">*</span>}
        </div>
        <div style={{ flex: '1', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '150px' }}>
            <select 
              className="form-select" 
              value={state.fromSurah} 
              disabled={!!curriculumData}
              onChange={e => {
                handleChange('fromSurah', e.target.value);
                handleChange('fromAyah', ''); // Reset ayah when surah changes
              }}
            >
              <option value="">--- من سورة ---</option>
              {quranSurahs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '100px' }}>
            <select 
              className="form-select" 
              value={state.fromAyah} 
              onChange={e => handleChange('fromAyah', e.target.value)}
              disabled={!!curriculumData || !state.fromSurah}
            >
              <option value="">من الاية</option>
              {Array.from({ length: maxFromAyahs }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '150px' }}>
            <select 
              className="form-select" 
              value={state.toSurah} 
              disabled={!!curriculumData}
              onChange={e => {
                handleChange('toSurah', e.target.value);
                handleChange('toAyah', ''); // Reset ayah when surah changes
              }}
            >
              <option value="">--- الي سورة ---</option>
              {quranSurahs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '100px' }}>
            <select 
              className="form-select" 
              value={state.toAyah} 
              onChange={e => handleChange('toAyah', e.target.value)}
              disabled={!!curriculumData || !state.toSurah}
            >
              <option value="">الي الاية</option>
              {Array.from({ length: maxToAyahs }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  if (!isAllowed) {
    return (
      <div className="management-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="box-card" style={{ textAlign: 'center', maxWidth: '500px', padding: '40px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '15px' }}>عذراً، ليس لديك صلاحية لإضافة تقرير يومي لهذه الحلقة</h3>
          <p style={{ color: 'var(--text-secondary)' }}>لا يمكن إضافة التقارير إلا بواسطة المحفظ أو المنسق المسؤول عن هذه الحلقة أو إدارة النظام.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="management-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ textAlign: 'center', width: '100%' }}>ادارة التقارير اليومية [حلقة:{session?.session_no || sessionId}]</h2>
      </div>

      <div className="form-wrapper box-card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '30px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', fontSize: '18px' }}>إضافة تقرير يومي</h3>
        
        {/* Date and Session Num Row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
          <div style={{ width: '200px', fontWeight: 'bold' }}>التاريخ <span className="req">*</span></div>
          <div style={{ flex: '1', display: 'flex', gap: '20px' }}>
            <div className="form-group" style={{ flex: '1' }}>
              <input 
                type="date" 
                className="form-input" 
                value={date} 
                min={getLocalDateString(-48)}
                max={getLocalDateString(0)}
                onChange={(e) => setDate(e.target.value)} 
                style={isInvalidDay ? { borderColor: '#ef4444' } : {}}
              />
              {holiday && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px', fontWeight: 'bold' }}>
                  هذا اليوم إجازة{holiday.name ? ` (${holiday.name})` : ''} ولا يمكن إدراج تقرير فيه.
                </div>
              )}
              {isInvalidDay && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px', fontWeight: 'bold' }}>
                  تنبيه: هذا اليوم ({selectedDayName}) لا يوافق أيام عمل الحلقة ({sessionWorkDays.join('، ')}).
                </div>
              )}
            </div>
            <div className="form-group" style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <label style={{ margin: 0, fontWeight: 'bold', whiteSpace: 'nowrap' }}>رقم الجلسة</label>
              {curriculumData ? (
                <select 
                  className="form-select" 
                  value={sessionNum} 
                  disabled={isPlatform && !canOverrideSessionNum}
                  onChange={(e) => applySessionNumber(e.target.value)}
                >
                  <option value="">اختار رقم الجلسة</option>
                  {curriculumData.map(c => (
                    <option key={c.session} value={c.session}>جلسة {c.session}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  className="form-input" 
                  value={sessionNum} 
                  readOnly={isPlatform && !canOverrideSessionNum}
                  onChange={(e) => setSessionNum(e.target.value)} 
                  placeholder="رقم الجلسة"
                />
              )}
            </div>
          </div>
        </div>

        {renderSectionFields('الحفظ', memorization, setMemorization, true)}
        {renderSectionFields('التسميع', review, setReview, true)}
        {renderSectionFields('مراجعة الماضي القريب', recentReview, setRecentReview)}
        {!isLevelOneChild && renderSectionFields('مراجعة الماضي البعيد', distantReview, setDistantReview)}

        <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: '30px', flexDirection: 'row-reverse' }}>
          <button className="btn btn-primary" style={{ padding: '10px 40px' }} onClick={handleSave}>حفظ</button>
          <button className="btn btn-outline" style={{ padding: '10px 40px' }} onClick={() => {
             setMemorization({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
             setReview({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
             setRecentReview({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
             setDistantReview({ fromSurah: '', fromAyah: '', toSurah: '', toAyah: '' });
          }}>اعادة ادخال</button>
          <button className="btn btn-secondary" style={{ padding: '10px 40px', background: '#6b7280', color: 'white', border: 'none' }} onClick={() => navigate(-1)}>رجوع</button>
        </div>
      </div>
    </div>
  );
}

export default SessionReportsAdd;
