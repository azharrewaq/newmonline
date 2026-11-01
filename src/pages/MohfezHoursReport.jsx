import React, { useState, useMemo } from 'react';
import { Download, Search, Clock, Users, BookOpen, BarChart2 } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportMultiSheetToXLSX } from '../utils/xlsxHelper';
import { isSessionTaughtByMohfez } from '../utils/userScopeHelper';

// ─── منطق حساب مدة الحلقة وفق جدول الأزهر الشريف ─────────────────────────
const normalizeAr = (str) => {
  if (!str) return '';
  return str
    .toString().trim()
    .normalize('NFKD').normalize('NFC')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase().trim();
};

const isChildren = (rowaq) => normalizeAr(rowaq || '').includes('اطفال');
const isSeniors  = (rowaq) =>
  normalizeAr(rowaq || '').includes('كبار') ||
  normalizeAr(rowaq || '').includes('تجويد') ||
  normalizeAr(rowaq || '').includes('قراءات');

const childLevels1to6 = ['الاول','الثاني','الثالث','الرابع','الخامس','السادس'];
const childLevels7to10 = ['السابع','الثامن','التاسع','العاشر'];

const isSeniorsLong  = (level) => { const n = normalizeAr(level||''); return n.includes('اربع') || n.includes('خمس'); };
const isSeniorsShort = (level) => { const n = normalizeAr(level||''); return n.includes('واحد') || n.includes('عامين') || n.includes('ثلاث'); };

/**
 * حساب مدة الحلقة بالساعات بناءً على جدول الأزهر الشريف
 */
const calcDuration = (presentCount, rowaq, level) => {
  const n = Number(presentCount) || 0;
  if (n === 0) return 0;

  const child = isChildren(rowaq);
  const senior = isSeniors(rowaq);
  const isLvl1Child = child && normalizeAr(level || '') === 'الاول';

  if (child) {
    if (n === 1) return 0.5;
    if (n === 2) return isLvl1Child ? 0.5 : 1;
    if (n === 3) return 1;
    if (n === 4) {
      if (childLevels7to10.includes(normalizeAr(level || ''))) return 1.5;
      return 1;
    }
    return 1.5; // 5-6
  }

  if (senior) {
    if (n === 1) return 0.5;
    if (n === 2) return 1;
    if (n === 3) return 1;
    if (n === 4) return isSeniorsLong(level) ? 1 : 1.5;
    return 1.5; // 5-6
  }

  // افتراضي
  if (n === 1) return 0.5;
  if (n <= 3)  return 1;
  return 1.5;
};

const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

const durationBadge = (d) => {
  if (d <= 0)   return { bg:'rgba(107,114,128,.15)', color:'#6b7280', label:'-' };
  if (d <= 0.5) return { bg:'rgba(245,158,11,.15)', color:'#f59e0b', label:'نصف ساعة' };
  if (d <= 1)   return { bg:'rgba(59,130,246,.15)', color:'#3b82f6', label:'ساعة' };
  return              { bg:'rgba(16,185,129,.15)',  color:'#10b981', label:'ساعة ونصف' };
};

// ─── التحقق من إشراف المنسق على الحلقة ──────────────────────────────────────────
const isSessionSupervisedByCoordinator = (session, user, platformCoordinators = [], users = []) => {
  if (!session || !user) return false;

  const userNormName = normalizeAr(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // 1. التطابق المباشر مع حقل المنسق المشرف في الحلقة
  if (session.coordinator && userNormName && normalizeAr(session.coordinator) === userNormName) {
    return true;
  }

  // 2. التطابق عبر سجلات منسقي المنصة (بالرقم القومي أو اسم المستخدم)
  const matchedCoordRecord = platformCoordinators.find(c => 
    (c.national_id && String(c.national_id).trim() === userNationalId) ||
    (c.username && String(c.username).trim() === String(user.username || '').trim()) ||
    (c.name && normalizeAr(c.name) === userNormName)
  );

  if (matchedCoordRecord && session.coordinator) {
    if (normalizeAr(session.coordinator) === normalizeAr(matchedCoordRecord.name || '')) {
      return true;
    }
  }

  // 3. التطابق عبر حقل userSession المربوط بالمستخدم الحالي
  if (user.userSession) {
    const sId = String(session.id);
    const sNo = String(session.session_no || '');
    const sName = String(session.session_name || '');
    const uS = String(user.userSession);
    if (sId === uS || sNo === uS || sName === uS) {
      return true;
    }
  }

  // 4. التطابق عبر جدول المستخدمين (users)
  const coordUserInList = users.find(u => 
    u.role === 'platform_coordinator' && 
    ((u.national_id && String(u.national_id).trim() === userNationalId) ||
     (u.username && String(u.username).trim() === String(user.username || '').trim()) ||
     (u.name && normalizeAr(u.name) === userNormName))
  );

  if (coordUserInList?.userSession) {
    const sId = String(session.id);
    const sNo = String(session.session_no || '');
    const uS = String(coordUserInList.userSession);
    if (sId === uS || sNo === uS) {
      return true;
    }
  }

  return false;
};

// ─── مكوّن صف المحفظ مع التفاصيل ──────────────────────────────────────────────
function MohfezRow({ row, idx }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        style={{ cursor:'pointer', transition:'background .15s' }}
        onClick={() => setOpen(o => !o)}
      >
        <td style={{ textAlign:'center', color:'var(--text-muted)' }}>{idx + 1}</td>
        <td style={{ textAlign:'right', fontWeight:'bold', color:'var(--text-primary)', paddingRight:'16px' }}>
          <span style={{ marginLeft:'8px', fontSize:'11px', color:'var(--accent-primary)' }}>
            {open ? '▲' : '▼'}
          </span>
          {row.mohfez}
        </td>
        <td style={{ textAlign:'center' }}>
          <span style={{ background:'rgba(59,130,246,.15)', color:'#3b82f6', padding:'3px 10px', borderRadius:'12px', fontSize:'13px', fontWeight:'bold' }}>
            {row.totalSessions}
          </span>
        </td>
        <td style={{ textAlign:'center' }}>
          <span style={{ background:'rgba(16,185,129,.15)', color:'#10b981', padding:'3px 12px', borderRadius:'12px', fontSize:'14px', fontWeight:'bold' }}>
            {row.totalHours.toFixed(1)} ساعة
          </span>
        </td>
        <td style={{ textAlign:'center', color:'var(--text-secondary)', fontSize:'13px' }}>
          {row.totalSessions > 0 ? (row.totalHours / row.totalSessions).toFixed(2) : 0} ساعة/جلسة
        </td>
        <td style={{ textAlign:'center' }}>
          <span style={{ fontSize:'12px', color:'var(--accent-primary)', borderBottom:'1px dashed var(--accent-primary)', cursor:'pointer' }}>
            {open ? 'إخفاء' : 'تفاصيل'}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan="6" style={{ padding:0 }}>
            <div style={{ background:'var(--bg-secondary)', borderTop:'1px solid var(--border-subtle)', padding:'16px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ color:'var(--text-muted)', borderBottom:'1px solid var(--border-subtle)' }}>
                    {['التاريخ','رقم الحلقة','الرواق','المستوى','عدد الحضور','مدة الجلسة','دخول المحفظ'].map(h => (
                      <th key={h} style={{ padding:'6px 10px', textAlign:'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.sessions
                    .sort((a, b) => (a.date||'').localeCompare(b.date||''))
                    .map((s, i) => {
                      const bd = durationBadge(s.duration);
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                          <td style={{ padding:'6px 10px', textAlign:'center', direction:'ltr', fontWeight:'bold' }}>{s.date}</td>
                          <td style={{ padding:'6px 10px', textAlign:'center' }}>{s.sessionNo || '-'}</td>
                          <td style={{ padding:'6px 10px', textAlign:'center', fontSize:'12px' }}>{s.rowaq || '-'}</td>
                          <td style={{ padding:'6px 10px', textAlign:'center', fontSize:'12px' }}>{s.level || '-'}</td>
                          <td style={{ padding:'6px 10px', textAlign:'center' }}>
                            <span style={{ background:'rgba(245,158,11,.15)', color:'#f59e0b', padding:'2px 8px', borderRadius:'10px', fontWeight:'bold' }}>
                              {s.presentCount}
                            </span>
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'center' }}>
                            <span style={{ background: bd.bg, color: bd.color, padding:'2px 10px', borderRadius:'10px', fontWeight:'bold' }}>
                              {bd.label}
                            </span>
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'center', fontSize:'12px', color: s.mohfezJoinedAt ? '#10b981' : 'var(--text-muted)' }}>
                            {s.mohfezJoinedAt ? new Date(s.mohfezJoinedAt).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : 'غير مسجل'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop:'2px solid var(--accent-primary)', fontWeight:'bold', color:'var(--accent-primary)' }}>
                    <td colSpan="4" style={{ padding:'8px 10px', textAlign:'center' }}>المجموع (أيام دخول المحفظ: {row.joinedCount || 0} من {row.totalSessions})</td>
                    <td style={{ textAlign:'center' }}>{row.sessions.reduce((s,r)=>s+r.presentCount,0)} دارس</td>
                    <td style={{ textAlign:'center' }}>{row.totalHours.toFixed(1)} ساعة</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── مكوّن الصفحة الرئيسي ──────────────────────────────────────────────────────
function MohfezHoursReport() {
  const { 
    platformSessions, 
    platformStudents, 
    platformCoordinators = [], 
    platformMohfezs = [],
    users = [], 
    attendances, 
    staffAttendances = [],
    hasPermission 
  } = useAppData();

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser?.role || 'admin';
  const isPlatformMohfez = role === 'platform_mohfez' || role === 'mohfez';
  const isPlatformCoordinator = role === 'platform_coordinator';

  const today = new Date();
  const [selYear,   setSelYear]   = useState(String(today.getFullYear()));
  const [selMonth,  setSelMonth]  = useState(String(today.getMonth() + 1));
  const [selMohfez, setSelMohfez] = useState('');
  const [selRowaq,  setSelRowaq]  = useState('');

  // الحلقات ذات الصلة: إذا كان منسق منصة أو محفظ، تقتصر فقط على الحلقات التابعة له
  const relevantSessions = useMemo(() => {
    if (isPlatformCoordinator) {
      return platformSessions.filter(s => isSessionSupervisedByCoordinator(s, currentUser, platformCoordinators, users));
    }
    if (isPlatformMohfez) {
      return platformSessions.filter(s => isSessionTaughtByMohfez(s, currentUser, platformMohfezs, users));
    }
    return platformSessions;
  }, [platformSessions, isPlatformCoordinator, isPlatformMohfez, currentUser, platformCoordinators, platformMohfezs, users]);

  const mohfezList = useMemo(() => {
    const names = new Set();
    relevantSessions.forEach(s => { if (s.mohfez) names.add(s.mohfez); });
    return Array.from(names).sort();
  }, [relevantSessions]);

  const rowaqList = useMemo(() => {
    const rws = new Set();
    relevantSessions.forEach(s => { if (s.rowaq) rws.add(s.rowaq); });
    return Array.from(rws).sort();
  }, [relevantSessions]);

  const years = useMemo(() => {
    const ys = new Set([String(today.getFullYear())]);
    attendances.forEach(a => {
      const d = (a.date || '').replace(/\//g, '-');
      const y = d.split('-')[0];
      if (y && y.length === 4) ys.add(y);
    });
    return Array.from(ys).sort().reverse();
  }, [attendances]);

  const reportData = useMemo(() => {
    const mm   = String(selMonth).padStart(2, '0');
    const yyyy = selYear;

    const monthlyAtts = attendances.filter(a => {
      if (!a.isPlatform) return false;
      const d = (a.date || '').replace(/\//g, '-');
      return d.startsWith(`${yyyy}-${mm}`);
    });

    const map = {};
    monthlyAtts.forEach(att => {
      const session = platformSessions.find(s => String(s.id) === String(att.sessionId));
      if (!session) return;

      // قيود المنسق: عرض الحلقات التي يشرف عليها المنسق فقط
      if (isPlatformCoordinator && !isSessionSupervisedByCoordinator(session, currentUser, platformCoordinators, users)) {
        return;
      }

      const mohfezName = session.mohfez || '-';

      if (selMohfez && mohfezName !== selMohfez) return;
      if (isPlatformMohfez && !isSessionTaughtByMohfez(session, currentUser, platformMohfezs, users)) return;

      const active = (att.records || []).filter(r => {
        const st = platformStudents.find(s => String(s.id) === String(r.studentId));
        return !st?.isArchived;
      });
      const presentCount = active.filter(r => r.isPresent).length;
      const duration     = calcDuration(presentCount, session.rowaq, session.level);
      // حضور المحفظ المسجل تلقائياً عند دخوله رابط الحلقة في نفس اليوم
      const attDay = (att.date || '').replace(/\//g, '-');
      const joined = staffAttendances.find(sa =>
        String(sa.sessionId) === String(att.sessionId) && sa.role === 'platform_mohfez' && sa.date === attDay
      );

      if (!map[mohfezName]) {
        map[mohfezName] = { mohfez: mohfezName, sessions: [], totalSessions: 0, totalHours: 0 };
      }
      map[mohfezName].sessions.push({
        date: att.date, sessionNo: session.session_no,
        rowaq: session.rowaq, level: session.level,
        presentCount, duration,
        mohfezJoinedAt: joined ? joined.joinedAt : null
      });
      map[mohfezName].totalSessions++;
      map[mohfezName].totalHours += duration;
      if (joined) map[mohfezName].joinedCount = (map[mohfezName].joinedCount || 0) + 1;
    });

    return Object.values(map).sort((a, b) => a.mohfez.localeCompare(b.mohfez, 'ar'));
  }, [attendances, staffAttendances, platformSessions, platformStudents, selYear, selMonth, selMohfez, selRowaq, isPlatformMohfez, isPlatformCoordinator, currentUser, platformCoordinators, users]);

  const grandHours    = reportData.reduce((s, r) => s + r.totalHours, 0);
  const grandSessions = reportData.reduce((s, r) => s + r.totalSessions, 0);

  const handleExport = () => {
    if (reportData.length === 0) return;

    // ورقة ملخص المحفظين
    const summaryData = reportData.map((m, idx) => ({
      'م': idx + 1,
      'اسم المحفظ': m.mohfez,
      'إجمالي عدد الحلقات': m.totalSessions,
      'إجمالي الساعات': Number(m.totalHours.toFixed(1)),
      'أيام دخول المحفظ': m.joinedCount || 0,
    }));

    // إضافة سطر المجموع النهائي في نهاية الملخص
    summaryData.push({
      'م': 'المجموع',
      'اسم المحفظ': `عدد المحفظين: ${reportData.length}`,
      'إجمالي عدد الحلقات': grandSessions,
      'إجمالي الساعات': Number(grandHours.toFixed(1)),
    });

    // ورقة تفاصيل كل حلقة
    const detailsData = [];
    let dIdx = 1;
    reportData.forEach(m => {
      m.sessions.forEach(s => {
        const bd = durationBadge(s.duration);
        detailsData.push({
          'م': dIdx++,
          'اسم المحفظ': m.mohfez,
          'الرواق': s.rowaq || '-',
          'المستوى': s.level || '-',
          'رقم الحلقة': s.sessionNo || '-',
          'التاريخ': s.date || '-',
          'عدد الحضور': s.presentCount,
          'المدة المستحقة': bd.label,
          'الساعات': s.duration,
          'دخول المحفظ للحلقة': s.mohfezJoinedAt ? new Date(s.mohfezJoinedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'غير مسجل',
        });
      });
    });

    const filenamePrefix = isPlatformCoordinator
      ? `تقرير_ساعات_محفظي_المنسق_${currentUser?.name || 'منسق'}`
      : 'تقرير_ساعات_المحفظين';

    exportMultiSheetToXLSX([
      { sheetName: 'ملخص المحفظين', data: summaryData },
      { sheetName: 'تفاصيل الحلقات', data: detailsData }
    ], `${filenamePrefix}_${selMonth}-${selYear}`);
  };

  if (!hasPermission('reports', 'view')) {
    return (
      <div className="management-page" style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'400px' }}>
        <div className="box-card" style={{ textAlign:'center', maxWidth:'500px', padding:'40px', border:'1px solid rgba(239,68,68,.3)' }}>
          <h3 style={{ color:'#ef4444', marginBottom:'15px' }}>عذراً، ليس لديك صلاحية لعرض هذا القسم</h3>
        </div>
      </div>
    );
  }

  const monthLabel = `${MONTHS_AR[parseInt(selMonth, 10) - 1]} ${selYear}`;

  return (
    <div className="management-page" dir="rtl">

      {/* رأس الصفحة */}
      <div className="page-header" style={{ marginBottom:'24px' }}>
        <h2 style={{ textAlign:'center', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}>
          <Clock size={24} style={{ color:'var(--accent-primary)' }} />
          {isPlatformCoordinator 
            ? `تقرير ساعات المحفظين المشرف عليهم (${currentUser?.name || 'المنسق'})`
            : 'تقرير حساب الساعات الشهري للمحفظ'}
        </h2>
        <p style={{ textAlign:'center', color:'var(--text-muted)', marginTop:'6px', fontSize:'13px' }}>
          {isPlatformCoordinator
            ? 'عرض ساعات الحلقات والجلسات المنفذة للمحفظين الخاضعين لإشرافك وفق جدول المدة الزمنية للأزهر الشريف'
            : 'يُحسب وقت الجلسة تلقائياً وفق جدول المدة الزمنية لحلقات الجامع الأزهر الشريف'}
        </p>
      </div>

      {/* بطاقات الإجمالي */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'16px', marginBottom:'24px' }}>
        {[
          { icon:<BarChart2 size={26} />, color:'#3b82f6', value: grandSessions,           label: isPlatformCoordinator ? 'إجمالي الجلسات المشرف عليها' : 'إجمالي الجلسات' },
          { icon:<Clock size={26} />,     color:'#10b981', value: grandHours.toFixed(1)+' ساعة', label: isPlatformCoordinator ? 'إجمالي ساعات المحفظين' : 'إجمالي الساعات' },
          { icon:<Users size={26} />,     color:'#f59e0b', value: reportData.length,        label: isPlatformCoordinator ? 'المحفظين المشرف عليهم' : 'عدد المحفظين' },
          { icon:<BookOpen size={26} />,  color:'#8b5cf6', value: monthLabel,               label:'الفترة المحددة', small:true },
        ].map((c, i) => (
          <div key={i} className="box-card" style={{ padding:'20px', borderTop:`3px solid ${c.color}`, textAlign:'center' }}>
            <div style={{ color: c.color, marginBottom:'8px', display:'flex', justifyContent:'center' }}>{c.icon}</div>
            <div style={{ fontSize: c.small?'16px':'26px', fontWeight:'bold', color:'var(--text-primary)' }}>{c.value}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر البحث */}
      <div className="search-section box-card" style={{ marginBottom:'20px' }}>
        <h3 style={{ fontSize:'14px', color:'var(--text-muted)', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
          <Search size={15} /> فلاتر البحث
        </h3>
        <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ minWidth:'110px' }}>
            <label>السنة</label>
            <select className="form-select" value={selYear} onChange={e => setSelYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth:'130px' }}>
            <label>الشهر</label>
            <select className="form-select" value={selMonth} onChange={e => setSelMonth(e.target.value)}>
              {MONTHS_AR.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
            </select>
          </div>
          {!isPlatformMohfez && (
            <div className="form-group" style={{ minWidth:'190px', flex:1 }}>
              <label>{isPlatformCoordinator ? 'المحفظ المشرف عليه' : 'المحفظ'}</label>
              <select className="form-select" value={selMohfez} onChange={e => setSelMohfez(e.target.value)}>
                <option value="">كل المحفظين</option>
                {mohfezList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ minWidth:'190px', flex:1 }}>
            <label>الرواق</label>
            <select className="form-select" value={selRowaq} onChange={e => setSelRowaq(e.target.value)}>
              <option value="">كل الأروقة</option>
              {rowaqList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button className="btn btn-primary" onClick={handleExport} disabled={reportData.length === 0}
              style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <Download size={15} /> تصدير إكسيل (XLSX)
            </button>
            <button className="btn btn-outline" onClick={() => { setSelMohfez(''); setSelRowaq(''); }}>
              إعادة تعيين
            </button>
          </div>
        </div>
      </div>

      {/* معيار المدة */}
      <div style={{
        background:'var(--bg-secondary)', borderRadius:'10px', padding:'14px 18px',
        marginBottom:'20px', fontSize:'13px', color:'var(--text-secondary)',
        border:'1px solid var(--border-subtle)', lineHeight:'2'
      }}>
        <strong style={{ color:'var(--accent-primary)', fontSize:'14px' }}>
          📋 معيار حساب المدة — جدول الجامع الأزهر الشريف (عام 2026):
        </strong>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 28px', marginTop:'6px' }}>
          <span>
            <span style={{ color:'#f59e0b', fontWeight:'bold' }}>نصف ساعة: </span>
            دارس واحد (أطفال وكبار) | 2 دارس بالمستوى الأول أطفال
          </span>
          <span>
            <span style={{ color:'#3b82f6', fontWeight:'bold' }}>ساعة: </span>
            2-3 دارسين (مستوى 2-10 أطفال) | 2-3 دارسين كبار | 4 دارسين (مستوى 1-6 أطفال) | 4 دارسين كبار نظام 4-5 سنوات
          </span>
          <span>
            <span style={{ color:'#10b981', fontWeight:'bold' }}>ساعة ونصف: </span>
            4 دارسين (مستوى 7-10 أطفال) | 4 دارسين كبار نظام 1-3 سنوات | 5-6 دارسين
          </span>
        </div>
      </div>

      {/* الجدول الرئيسي */}
      <div className="box-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h3 style={{ fontSize:'16px', color:'var(--text-primary)', display:'flex', alignItems:'center', gap:'8px' }}>
            <Users size={18} style={{ color:'var(--accent-primary)' }} />
            ملخص ساعات المحفظين — {monthLabel}
          </h3>
          <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>{reportData.length} محفظ</span>
        </div>

        <div className="table-wrapper">
          <table className="management-table">
            <thead>
              <tr style={{ background:'var(--bg-secondary)' }}>
                {['م','اسم المحفظ','عدد الجلسات','إجمالي الساعات','معدل الجلسة','التفاصيل'].map(h => (
                  <th key={h} style={{ textAlign:'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign:'center', color:'var(--text-muted)', padding:'60px' }}>
                    {isPlatformCoordinator ? (
                      <>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          لا توجد بيانات ساعات مسجلة للمحفظين المشرف عليهم لهذا الشهر ({monthLabel}).
                        </div>
                        <small style={{ fontSize:'12px' }}>تأكد من اختيار الشهر المطلوب، أو مراجعة تسجيل حضور حلقاتك المشرف عليها.</small>
                      </>
                    ) : (
                      <>
                        لا توجد بيانات حضور مسجّلة لهذا الشهر.<br />
                        <small style={{ fontSize:'12px' }}>تأكد من تسجيل بيانات الحضور في صفحة كل حلقة.</small>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <MohfezRow key={row.mohfez} row={row} idx={idx} />
                ))
              )}

              {reportData.length > 0 && (
                <tr style={{
                  background:'linear-gradient(90deg,rgba(59,130,246,.12),rgba(16,185,129,.1))',
                  fontWeight:'bold', borderTop:'2px solid var(--accent-primary)'
                }}>
                  <td colSpan="2" style={{ textAlign:'center', color:'var(--accent-primary)', fontSize:'14px' }}>
                    الإجمالي العام
                  </td>
                  <td style={{ textAlign:'center', color:'#3b82f6', fontSize:'14px' }}>
                    {grandSessions} جلسة
                  </td>
                  <td style={{ textAlign:'center', color:'#10b981', fontSize:'16px' }}>
                    {grandHours.toFixed(1)} ساعة
                  </td>
                  <td style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'13px' }}>
                    {reportData.length > 0 ? (grandHours / reportData.length).toFixed(1) : 0} ساعة/محفظ
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MohfezHoursReport;
