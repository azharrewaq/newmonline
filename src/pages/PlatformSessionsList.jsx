import React, { useState, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Download, Upload, Edit, Trash2, ClipboardCheck, FileText, Video, Play, UserCheck } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportToXLSX, importFromXLSX } from '../utils/xlsxHelper';
import { filterSessionsForUser } from '../utils/userScopeHelper';
import { countriesList } from '../data/countries';
import { getJoinState, useNow, formatReportText, toLocalDateStr } from '../utils/sessionHelpers';
import { getSubstitutionFor } from '../utils/userScopeHelper';
import { getApplicantExamJoinState, formatTime12Ar } from '../utils/placementHelpers';
import SubstituteModal from '../components/SubstituteModal';

function PlatformSessionsList() {
  const { 
    platformSessions, 
    deletePlatformSession, 
    addPlatformSession, 
    rowaqs, 
    hasPermission, 
    deleteAllPlatformSessions,
    platformCoordinators = [],
    platformMohfezs = [],
    platformStudents = [],
    users = [],
    holidays = [],
    sessionReports = [],
    substitutions = [],
    platformApplicants = [],
    placementGroups = [],
    updatePlatformApplicant,
    recordSessionJoin
  } = useAppData();
  const importRef = useRef(null);
  const [substituteFor, setSubstituteFor] = useState(null);
  const [searchParams] = useSearchParams();
  const now = useNow(30000);
  const [expandedReports, setExpandedReports] = useState({});
  
  // Get current user and role
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser ? currentUser.role : 'admin';
  const isStudent = role === 'student' || role === 'sharia_student';
  // تعيين محفظ بديل: الإدارة والمشرفون ومنسق الحلقة (الحلقات المعروضة له مقصورة على حلقاته)
  const canAssignSubstitute = ['admin', 'platform_admin', 'platform_supervisor', 'platform_coordinator'].includes(role);

  const [filterCountry, setFilterCountry] = useState('');
  const [filterRowaq, setFilterRowaq] = useState('');
  const [filterStudentType, setFilterStudentType] = useState('');
  const [filterActiveNow, setFilterActiveNow] = useState(searchParams.get('active') === 'true');

  // زر الدخول للحلقة: يُفعَّل قبل الموعد بربع ساعة ويتوقف مع انتهاء وقت الحلقة (الأدمن مستثنى)
  const renderJoinButton = (s) => {
    const joinState = getJoinState(s, holidays, now);
    const canJoin = role === 'admin' || joinState.open;
    const baseStyle = {
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px',
      textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', border: 'none', fontFamily: 'inherit',
      color: 'white', backgroundColor: canJoin ? '#10b981' : '#6b7280',
      cursor: canJoin ? 'pointer' : 'not-allowed', opacity: canJoin ? 1 : 0.7
    };
    const isEmbedded = s.stream_type === 'embedded';
    const Icon = isEmbedded ? Play : Video;
    if (!canJoin) {
      return (
        <button type="button" disabled title={joinState.reason} style={baseStyle}>
          <Icon size={14}/> الدخول للحلقة
        </button>
      );
    }
    if (isEmbedded) {
      // البث المدمج يُفتح في تبويب جديد (يتم تسجيل الحضور داخل صفحة البث)
      return (
        <button type="button" title="الدخول للحلقة" style={baseStyle}
          onClick={() => window.open(`/live/${s.id}`, '_blank')}>
          <Icon size={14}/> الدخول للحلقة
        </button>
      );
    }
    return (
      <a href={s.teams_link} target="_blank" rel="noopener noreferrer" title="الدخول للحلقة" style={baseStyle}
        onClick={() => recordSessionJoin(s, currentUser)}>
        <Icon size={14}/> الدخول للحلقة
      </a>
    );
  };

  const formatTimeTo12Hour = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hourFormatted = String(hours).padStart(2, '0');
    return `${hourFormatted}:${minutes} ${ampm}`;
  };

  // 1. فلترة الحلقات بدقة حسب صلاحية ونطاق المستخدم (منسق، محفظ، دارس)
  const scopedSessions = useMemo(() => {
    return filterSessionsForUser(platformSessions, currentUser, {
      platformCoordinators,
      platformMohfezs,
      platformStudents,
      users
    });
  }, [platformSessions, currentUser, platformCoordinators, platformMohfezs, platformStudents, users, substitutions]);

  // 2. تطبيق فلاتر واجهة المستخدم
  const filtered = scopedSessions.filter(s => {
    if (filterCountry && !(s.countries && s.countries.includes(filterCountry))) return false;
    if (filterRowaq && s.rowaq !== filterRowaq) return false;
    if (filterStudentType && s.student_type !== filterStudentType) return false;
    
    if (filterActiveNow) {
      const dayNamesMap = {
        0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت'
      };
      const currentDayName = dayNamesMap[new Date().getDay()];
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const isTodayWorkday = s.workDays && s.workDays.includes(currentDayName);
      if (!isTodayWorkday) return false;
      if (!s.time_start || !s.time_end) return false;
      
      const startMin = timeToMinutes(s.time_start);
      const endMin = timeToMinutes(s.time_end);
      if (currentMinutes < startMin || currentMinutes > endMin) return false;
    }
    
    return true;
  });

  const handleExport = () => {
    const exportData = filtered.map(s => ({
      'رقم الحلقة': s.session_no,
      'رابط الحلقة': s.teams_link || '',
      'المحفظ': s.mohfez || '',
      'المنسق': s.coordinator || '',
      'الدول': s.countries ? s.countries.join(', ') : '',
      'الرواق': s.rowaq,
      'المستوى': s.level,
      'الدارسين': s.student_type,
    }));
    exportToXLSX(exportData, 'الحلقات', 'حلقات المنصة');
  };

  const handleExportTemplate = () => {
    exportToXLSX([{
      'رقم الحلقة': '',
      'رابط الحلقة': '',
      'المحفظ': '',
      'المنسق': '',
      'الدول': '',
      'الرواق': '',
      'المستوى': '',
      'الدارسين': '',
    }], 'نموذج_استيراد_الحلقات', 'نموذج');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      rows.forEach(row => {
        addPlatformSession({
          session_no: row['رقم الحلقة'] || Date.now().toString().slice(-8),
          teams_link: row['رابط الحلقة'] || '',
          mohfez: row['المحفظ'] || '',
          coordinator: row['المنسق'] || '',
          countries: row['الدول'] ? row['الدول'].split(', ') : [],
          rowaq: row['الرواق'] || '',
          level: row['المستوى'] || '',
          student_type: row['الدارسين'] || '',
        });
      });
      alert('تم استيراد البيانات بنجاح');
    } catch {
      alert('حدث خطأ في استيراد الملف');
    }
    e.target.value = '';
  };

  // عرض الدارس: تقرير حلقته فقط في شكل نص منسق يُفرَّغ تلقائياً من تقرير المحفظ
  // وإذا كان من المتقدمين الجدد: تظهر له بطاقة اختبار تحديد المستوى (يظهر الرابط في يوم اختباره فقط قبل الموعد بـ 15 دقيقة وبعده بـ 30 دقيقة)
  if (isStudent && hasPermission('sessions', 'view')) {
    const userNid = String(currentUser?.national_id || currentUser?.username || '').trim();
    const myApplicant = platformApplicants.find(a =>
      String(a.national_id || a.passport_no || '').trim() === userNid
    );
    const myPlacementGroup = myApplicant
      ? placementGroups.find(g => Number(g.group_no) === Number(myApplicant.group_no))
      : null;
    const examJoin = myApplicant ? getApplicantExamJoinState(myApplicant, myPlacementGroup, now) : null;
    const examLink = myApplicant?.teams_link || myPlacementGroup?.teams_link || '';
    const examMohfez = myApplicant?.mohfez || myPlacementGroup?.mohfez || '-';
    const examCoord = myApplicant?.coordinator || myPlacementGroup?.coordinator || '-';
    const examShift = myPlacementGroup?.shift_label || (myApplicant?.exam_time ? formatTime12Ar(myApplicant.exam_time) : '-');

    const reportBoxStyle = {
      whiteSpace: 'pre-wrap', lineHeight: 2, background: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '14px 16px', margin: 0,
      fontFamily: 'inherit', fontSize: 15, direction: 'rtl', textAlign: 'right'
    };
    return (
      <div className="management-page">
        <div className="page-header">
          <div className="title-section">
            <h2>{scopedSessions.length > 0 ? 'تقرير الحلقة' : (myApplicant ? 'اختبار تحديد المستوى' : 'تقرير الحلقة')}</h2>
            <p>{scopedSessions.length > 0 ? 'آخر تقرير سجّله المحفظ لحلقتك' : (myApplicant ? 'بيانات لجنة وموعد اختبار تحديد المستوى الخاص بك' : 'آخر تقرير سجّله المحفظ لحلقتك')}</p>
          </div>
        </div>

        {myApplicant && scopedSessions.length === 0 && (
          <div className="box-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>
                  {myApplicant.group_no ? `مجموعة اختبار (${myApplicant.group_no})` : 'طلب التحاق وتحديد مستوى'}
                  {examMohfez && examMohfez !== '-' ? ` — الشيخ/ ${examMohfez}` : ''}
                </h3>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.9 }}>
                  <div>الدارس: <strong style={{ color: 'var(--text-primary)' }}>{myApplicant.name}</strong></div>
                  <div>تاريخ الاختبار: <strong style={{ color: 'var(--text-primary)', direction: 'ltr', display: 'inline-block' }}>{myApplicant.exam_date || 'سيتم تحديده قريباً'}</strong> • الفترة/التوقيت: <strong style={{ color: 'var(--text-primary)' }}>{myApplicant.exam_time ? formatTime12Ar(myApplicant.exam_time) : examShift}</strong></div>
                  <div>المحفظ الممتحن: <strong style={{ color: 'var(--text-primary)' }}>{examMohfez}</strong> • المنسق المشرف: <strong style={{ color: 'var(--text-primary)' }}>{examCoord}</strong></div>
                  {myApplicant.rowaq && (
                    <div>
                      الرواق: <strong>{myApplicant.rowaq}</strong>
                      {myApplicant.level ? ` • المستوى: ${myApplicant.level}` : ''}
                      {myApplicant.stopped_surah ? ` • متوقف عند سورة: ${myApplicant.stopped_surah}` : ''}
                      {myApplicant.preferred_days ? ` • الأيام المناسبة: ${myApplicant.preferred_days}` : ''}
                      {myApplicant.preferred_time ? ` • التوقيت المناسب: ${myApplicant.preferred_time}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* الرابط يختفي تماماً ماعدا دارسي اليوم الخاص بالاختبار (قبل الموعد بـ 15 دقيقة وبعده بـ 30 دقيقة) */}
              {examJoin?.visible && examLink ? (
                <a
                  href={examLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => updatePlatformApplicant(myApplicant.id, { exam_attended: true, exam_joined_at: new Date().toISOString() })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: '#10b981',
                    color: '#fff', padding: '10px 18px', borderRadius: 6, textDecoration: 'none', fontWeight: 'bold', fontSize: 14
                  }}
                >
                  <Video size={16} /> الدخول لاختبار تحديد المستوى
                </a>
              ) : (
                <div style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  borderRadius: 6, padding: '8px 14px', fontSize: 13, color: 'var(--text-muted)'
                }}>
                  {examJoin?.reason || 'رابط الاختبار يظهر في يوم وموعد اختبارك فقط'}
                </div>
              )}
            </div>
          </div>
        )}

        {scopedSessions.length === 0 && !myApplicant ? (
          <div className="box-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>لا توجد حلقة مسجلة لك.</div>
        ) : scopedSessions.map(s => {
          const reports = sessionReports
            .filter(r => String(r.sessionId) === String(s.id) && !!r.isPlatform)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (parseInt(b.sessionNum, 10) || 0) - (parseInt(a.sessionNum, 10) || 0));
          const latest = reports[0];
          const older = reports.slice(1);
          const showOlder = !!expandedReports[s.id];
          return (
            <div key={s.id} className="box-card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 15 }}>
                <div>
                  <h3 style={{ fontSize: 17, marginBottom: 4 }}>حلقة {s.session_no}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    المحفظ: {s.mohfez || '-'} • {(s.workDays || []).join('، ')} • {formatTimeTo12Hour(s.time_start)} - {formatTimeTo12Hour(s.time_end)}
                  </div>
                </div>
                {(s.stream_type === 'embedded' || s.teams_link) && renderJoinButton(s)}
              </div>
              {latest ? (
                <>
                  <pre style={reportBoxStyle}>{formatReportText(latest, s)}</pre>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(formatReportText(latest, s))}>نسخ التقرير</button>
                    {older.length > 0 && (
                      <button className="btn btn-outline" onClick={() => setExpandedReports(p => ({ ...p, [s.id]: !p[s.id] }))}>
                        {showOlder ? 'إخفاء التقارير السابقة' : `التقارير السابقة (${older.length})`}
                      </button>
                    )}
                  </div>
                  {showOlder && older.map(r => (
                    <pre key={r.id} style={{ ...reportBoxStyle, marginTop: 10 }}>{formatReportText(r, s)}</pre>
                  ))}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>لم يتم تسجيل تقرير لهذه الحلقة بعد.</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (!hasPermission('sessions', 'view')) {
    return (
      <div className="management-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="box-card" style={{ textAlign: 'center', maxWidth: '500px', padding: '40px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '15px' }}>عذراً، ليس لديك صلاحية لعرض هذا القسم</h3>
          <p style={{ color: 'var(--text-secondary)' }}>يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="title-section">
          <h2>حلقات المنصة</h2>
          <p>إدارة وعرض حلقات المنصة</p>
        </div>
      </div>

      {/* Search Filters */}
      <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '15px' }}>
          <div className="form-group">
            <label>الدولة</label>
            <select className="form-select" value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
              <option value="">--- اختار الدولة ---</option>
              {countriesList.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>
          
          
          <div className="form-group">
            <label>الرواق</label>
            <select className="form-select" value={filterRowaq} onChange={e => setFilterRowaq(e.target.value)}>
              <option value="">--- اختار الرواق ---</option>
              <option value="رواق القرآن الكريم ( أطفال )">رواق القرآن الكريم ( أطفال )</option>
              <option value="رواق القرآن الكريم ( كبار )">رواق القرآن الكريم ( كبار )</option>
              <option value="رواق التجويد">رواق التجويد</option>
              <option value="رواق القراءات">رواق القراءات</option>
            </select>
          </div>
          <div className="form-group">
            <label>نوع الدارسين</label>
            <select className="form-select" value={filterStudentType} onChange={e => setFilterStudentType(e.target.value)}>
              <option value="">--- اختار النوع ---</option>
              <option value="رجال">رجال</option>
              <option value="نساء">نساء</option>
              <option value="أطفال">أطفال</option>
            </select>
          </div>
        </div>
        <div className="search-actions" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={() => { 
              setFilterCountry(''); setFilterRowaq(''); 
              setFilterStudentType(''); 
              setFilterActiveNow(false);
            }}>إعادة تعيين</button>
            <button className="btn btn-primary" style={{ marginRight: '10px' }}><Search size={16} /> بحث</button>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', margin: 0, fontWeight: 'bold', color: '#10b981' }}>
            <input 
              type="checkbox" 
              checked={filterActiveNow} 
              onChange={e => setFilterActiveNow(e.target.checked)} 
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            عرض الحلقات الجارية حالياً فقط
          </label>
        </div>
      </div>

      {/* Table controls */}
      <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
        <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
          {hasPermission('sessions', 'add') && (
            <>
              <Link to="/platform-sessions/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Plus size={16} /> إضافة حلقة
              </Link>
              <button className="btn btn-gold-outline" onClick={() => importRef.current.click()}>
                <Upload size={16} /> استيراد
              </button>
              <button className="btn btn-outline" onClick={handleExportTemplate}>
                <Download size={16} /> تصدير نموذج
              </button>
              <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
            </>
          )}
          {hasPermission('sessions', 'delete') && platformSessions.length > 0 && (
            <button className="btn btn-danger" onClick={deleteAllPlatformSessions}>
              حذف الجميع
            </button>
          )}
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={16} /> تصدير
          </button>
        </div>
        <div className="table-stats">النتائج ({filtered.length})</div>
      </div>

      <div className="table-wrapper box-card">
        <table className="management-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>رقم الحلقة</th>
              <th style={{ textAlign: 'center' }}>المحفظ</th>
              <th style={{ textAlign: 'center' }}>المنسق</th>
              <th style={{ textAlign: 'center' }}>الدولة</th>
              <th style={{ textAlign: 'center' }}>الرواق</th>
              <th style={{ textAlign: 'center' }}>المستوى</th>
              <th style={{ textAlign: 'center' }}>الدارسين</th>
              <th style={{ textAlign: 'center' }}>الوقت من</th>
              <th style={{ textAlign: 'center' }}>الوقت إلى</th>
              <th style={{ textAlign: 'center' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  لا توجد بيانات.
                </td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{s.session_no}</td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const sub = getSubstitutionFor(s.id, toLocalDateStr(now), substitutions);
                      return sub ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{s.mohfez}</span>
                          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 12 }}>بديل اليوم: {sub.substituteName}</div>
                        </>
                      ) : s.mohfez;
                    })()}
                  </td>
                  <td style={{ textAlign: 'center', color: s.coordinator ? 'inherit' : 'var(--text-muted)' }}>{s.coordinator || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{s.countries ? s.countries.join('، ') : ''}</td>
                  <td style={{ textAlign: 'center' }}>{s.rowaq}</td>
                  <td style={{ textAlign: 'center' }}>{s.level}</td>
                  <td style={{ textAlign: 'center' }}>{s.student_type}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center' }}>{formatTimeTo12Hour(s.time_start) || '-'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center' }}>{formatTimeTo12Hour(s.time_end) || '-'}</td>
                  <td className="actions-cell" style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link to={`/platform-sessions/${s.id}/attendance`} title="الغياب" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', textDecoration: 'none' }}>
                      <ClipboardCheck size={14}/> الغياب
                    </Link>
                    {!isStudent && (
                      <Link to={`/platform-sessions/${s.id}/reports`} title="التقارير اليومية" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', textDecoration: 'none' }}>
                        <FileText size={14}/> التقارير
                      </Link>
                    )}
                    {canAssignSubstitute && (
                      <button title="محفظ بديل" onClick={() => setSubstituteFor(s)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                        <UserCheck size={14}/> بديل
                      </button>
                    )}
                    {hasPermission('sessions', 'edit') && (
                      <Link to={`/platform-sessions/create?id=${s.id}`} className="action-icon edit" style={{textDecoration: 'none', color: 'inherit'}} title="تعديل"><Edit size={16}/></Link>
                    )}
                    {hasPermission('sessions', 'delete') && (
                      <button className="action-icon delete" title="حذف" onClick={() => deletePlatformSession(s.id)}><Trash2 size={16}/></button>
                    )}
                    {s.stream_type === 'embedded' || s.teams_link ? renderJoinButton(s) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {substituteFor && <SubstituteModal session={substituteFor} onClose={() => setSubstituteFor(null)} />}
    </div>
  );
}

export default PlatformSessionsList;


