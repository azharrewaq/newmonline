import React, { useState, useMemo } from 'react';
import { 
  Download, Search, Clock, Users, BookOpen, BarChart2, 
  ChevronDown, ChevronUp, Calendar, CheckCircle, AlertCircle
} from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportMultiSheetToXLSX } from '../utils/xlsxHelper';

// ─── منطق حساب مدة الحلقة وفق جدول الأزهر الشريف 2026 ─────────────────────────
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

const childLevels1to6 = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
const childLevels7to10 = ['السابع', 'الثامن', 'التاسع', 'العاشر'];

const isSeniorsLong = (level) => {
  const n = normalizeAr(level || '');
  return n.includes('اربع') || n.includes('خمس');
};

export const calcDuration = (presentCount, rowaq, level) => {
  if (!presentCount || presentCount <= 0) return 0;

  if (isChildren(rowaq)) {
    if (presentCount === 1) return 0.5;
    if (presentCount === 2) {
      return normalizeAr(level || '').includes('الاول') ? 0.5 : 1.0;
    }
    if (presentCount === 3) return 1.0;
    if (presentCount === 4) {
      const match7to10 = childLevels7to10.some(l => normalizeAr(level || '').includes(normalizeAr(l)));
      return match7to10 ? 1.5 : 1.0;
    }
    if (presentCount >= 5) return 1.5;
  }

  if (isSeniors(rowaq)) {
    if (presentCount === 1) return 0.5;
    if (presentCount >= 2 && presentCount <= 3) return 1.0;
    if (presentCount === 4) {
      return isSeniorsLong(level) ? 1.0 : 1.5;
    }
    if (presentCount >= 5) return 1.5;
  }

  // افتراضي عام
  if (presentCount === 1) return 0.5;
  if (presentCount <= 3) return 1.0;
  return 1.5;
};

const durationBadge = (hours) => {
  if (hours === 0.5) return { label: 'نصف ساعة (0.5 س)', bg: '#fef3c7', text: '#92400e' };
  if (hours === 1.0) return { label: 'ساعة كاملة (1 س)', bg: '#dbeafe', text: '#1e40af' };
  if (hours === 1.5) return { label: 'ساعة ونصف (1.5 س)', bg: '#d1fae5', text: '#065f46' };
  if (hours === 0)   return { label: 'لا يوجد حضور (0 س)', bg: '#f3f4f6', text: '#6b7280' };
  return { label: `${hours} س`, bg: '#e0e7ff', text: '#3730a3' };
};

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// تنسيق أيام العمل (مثال: 5 أيام أو 4.5 يوم)
const formatWorkDays = (days) => {
  if (days === 0) return '0 يوم';
  const whole = Math.floor(days);
  const fraction = days - whole;
  if (fraction === 0) {
    return `${whole} ${whole === 1 ? 'يوم' : whole === 2 ? 'يومان' : whole <= 10 ? 'أيام' : 'يوم'}`;
  }
  return `${days.toFixed(1)} يوم`;
};

// ─── صف تفاصيل المنسق (قابل للتوسيع) ───────────────────────────────────────────
function CoordinatorRow({ row, index, onAssignSession, platformCoordinators, canEdit }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr style={{ background: open ? 'var(--bg-secondary)' : 'inherit', borderBottom: '1px solid var(--border-subtle)' }}>
        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
        <td style={{ fontWeight: '600' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{row.coordinator}</span>
            {row.isUnassigned && (
              <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px' }}>
                غير معين لمنسق
              </span>
            )}
          </div>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
            {row.phone || row.national_id || '-'}
          </span>
        </td>
        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.totalSessions} حلقة</td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '15px' }}>
            {row.totalHours.toFixed(1)}
          </span> ساعة
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: '15px', 
            color: '#10b981', 
            background: 'rgba(16,185,129,0.1)', 
            padding: '4px 12px', 
            borderRadius: '16px',
            display: 'inline-block'
          }}>
            {formatWorkDays(row.workDays)}
          </span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <button
            onClick={() => setOpen(p => !p)}
            className="btn btn-outline"
            style={{ padding: '4px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            {open ? <><ChevronUp size={14} /> طي التفاصيل</> : <><ChevronDown size={14} /> عرض الحلقات ({row.sessions.length})</>}
          </button>
        </td>
      </tr>

      {/* تفاصيل حلقات هذا المنسق */}
      {open && (
        <tr>
          <td colSpan="7" style={{ padding: '16px 20px', background: 'var(--bg-secondary)' }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '10px 16px', 
                background: 'var(--bg-secondary)', 
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  سجل الحلقات المنعقدة المشرف عليها: {row.coordinator}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  معادلة الاحتساب: (مجموع الساعات {row.totalHours.toFixed(1)} ÷ 3 = {formatWorkDays(row.workDays)})
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>م</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>رقم الحلقة</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>المحفظ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>الرواق</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>المستوى</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>التاريخ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>عدد الحضور</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>مدة الحلقة</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>نصيبها من أيام العمل</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>دخول المنسق</th>
                    {canEdit && <th style={{ padding: '8px 10px', textAlign: 'center' }}>المنسق المشرف</th>}
                  </tr>
                </thead>
                <tbody>
                  {row.sessions
                    .slice()
                    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                    .map((s, idx) => {
                      const bd = durationBadge(s.duration);
                      const dayPortion = (s.duration / 3).toFixed(2);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold' }}>{s.sessionNo}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{s.mohfez || '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{s.rowaq || '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{s.level || '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', direction: 'ltr' }}>{s.date}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 'bold' }}>{s.presentCount}</span> دارس
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{
                              background: bd.bg, color: bd.text,
                              padding: '2px 8px', borderRadius: '4px',
                              fontSize: '11px', fontWeight: 'bold', display: 'inline-block'
                            }}>
                              {bd.label}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>
                            {dayPortion} يوم ({s.duration} س)
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', color: s.coordinatorJoinedAt ? '#10b981' : 'var(--text-muted)' }}>
                            {s.coordinatorJoinedAt ? new Date(s.coordinatorJoinedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'غير مسجل'}
                          </td>
                          {canEdit && (
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <select 
                                className="form-select" 
                                style={{ padding: '2px 6px', fontSize: '11px', width: 'auto', display: 'inline-block' }}
                                value={s.currentCoordinator || ''}
                                onChange={(e) => onAssignSession && onAssignSession(s.sessionId, e.target.value)}
                              >
                                <option value="">غير معين</option>
                                {platformCoordinators.map(c => (
                                  <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--accent-primary)', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    <td colSpan="6" style={{ padding: '10px', textAlign: 'center' }}>المجموع الكلي (أيام دخول المنسق: {row.joinedCount || 0} من {row.totalSessions})</td>
                    <td style={{ textAlign: 'center' }}>{row.sessions.reduce((s, r) => s + r.presentCount, 0)} دارس</td>
                    <td style={{ textAlign: 'center' }}>{row.totalHours.toFixed(1)} ساعة</td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontSize: '13px' }}>
                      {formatWorkDays(row.workDays)}
                    </td>
                    <td></td>
                    {canEdit && <td></td>}
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

// ─── مكوّن الصفحة الرئيسي ──────────────────────────────────────────────────────
function CoordinatorWorkdaysReport() {
  const { 
    platformSessions, 
    platformStudents, 
    platformCoordinators, 
    attendances, 
    staffAttendances = [],
    users, 
    hasPermission,
    updatePlatformSession 
  } = useAppData();

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser?.role || 'admin';
  const isPlatformCoordinator = role === 'platform_coordinator';
  const canEdit = !isPlatformCoordinator && (hasPermission('sessions', 'edit') || ['admin', 'platform_admin', 'platform_supervisor'].includes(role));

  const today = new Date();
  const [selYear,   setSelYear]   = useState(String(today.getFullYear()));
  const [selMonth,  setSelMonth]  = useState(String(today.getMonth() + 1));
  const [selCoord,  setSelCoord]  = useState('');
  const [selRowaq,  setSelRowaq]  = useState('');
  const [selMohfez, setSelMohfez] = useState('');

  // قائمة أسماء المنسقين
  const coordinatorList = useMemo(() => {
    const names = new Set();
    platformCoordinators.forEach(c => { if (c.name) names.add(c.name); });
    platformSessions.forEach(s => { if (s.coordinator) names.add(s.coordinator); });
    users.filter(u => u.role === 'platform_coordinator').forEach(u => { if (u.name) names.add(u.name); });
    return Array.from(names).sort();
  }, [platformCoordinators, platformSessions, users]);

  // الحلقات ذات الصلة: إذا كان منسق منصة، تقتصر فقط على الحلقات التي يشرف عليها
  const relevantSessions = useMemo(() => {
    if (isPlatformCoordinator) {
      return platformSessions.filter(s => isSessionSupervisedByCoordinator(s, currentUser, platformCoordinators, users));
    }
    return platformSessions;
  }, [platformSessions, isPlatformCoordinator, currentUser, platformCoordinators, users]);

  // قائمة المحفظين
  const mohfezList = useMemo(() => {
    const names = new Set();
    relevantSessions.forEach(s => { if (s.mohfez) names.add(s.mohfez); });
    return Array.from(names).sort();
  }, [relevantSessions]);

  // قائمة الأروقة
  const rowaqList = useMemo(() => {
    const rws = new Set();
    relevantSessions.forEach(s => { if (s.rowaq) rws.add(s.rowaq); });
    return Array.from(rws).sort();
  }, [relevantSessions]);

  // قائمة السنوات المتوفرة في سجلات الغياب
  const years = useMemo(() => {
    const ys = new Set([String(today.getFullYear())]);
    attendances.forEach(a => {
      const d = (a.date || '').replace(/\//g, '-');
      const y = d.split('-')[0];
      if (y && y.length === 4) ys.add(y);
    });
    return Array.from(ys).sort().reverse();
  }, [attendances, today]);

  // ربط الحلقات بالمنسق المشرف
  // 1. إما من حقل session.coordinator
  // 2. أو من ربط مستخدم المنسق بحلقته في users (user.userSession)
  const getSessionCoordinator = (session) => {
    if (!session) return '';
    if (session.coordinator && session.coordinator.trim()) {
      return session.coordinator.trim();
    }
    // البحث في المستخدمين الذين دورهم platform_coordinator ولديهم userSession يطابق الحلقة
    const coordUser = users.find(u => 
      u.role === 'platform_coordinator' && 
      (String(u.userSession) === String(session.session_no) || String(u.userSession) === String(session.id))
    );
    if (coordUser?.name) return coordUser.name;
    return '';
  };

  // معالجة بيانات التقرير
  const reportData = useMemo(() => {
    const mm   = String(selMonth).padStart(2, '0');
    const yyyy = selYear;

    // تصفية سجلات غياب المنصة لهذا الشهر والسنة
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
      if (isPlatformCoordinator) {
        if (!isSessionSupervisedByCoordinator(session, currentUser, platformCoordinators, users)) {
          return;
        }
      }

      const coordName = isPlatformCoordinator
        ? (currentUser?.name || getSessionCoordinator(session) || 'المنسق')
        : (getSessionCoordinator(session) || 'غير معين لمنسق');

      // فلاتر البحث
      if (selCoord && coordName !== selCoord) return;
      if (selRowaq && session.rowaq !== selRowaq) return;
      if (selMohfez && session.mohfez !== selMohfez) return;
      if (isPlatformCoordinator && currentUser?.name &&
          normalizeAr(coordName) !== normalizeAr(currentUser.name)) return;

      // حساب الحضور الفعلي للدارسين غير المؤرشفين
      const active = (att.records || []).filter(r => {
        const st = platformStudents.find(s => String(s.id) === String(r.studentId));
        return !st?.isArchived;
      });
      const presentCount = active.filter(r => r.isPresent).length;
      const duration     = calcDuration(presentCount, session.rowaq, session.level);

      // حضور المنسق المسجل تلقائياً عند دخوله رابط الحلقة في نفس اليوم
      const attDay = (att.date || '').replace(/\//g, '-');
      const joined = staffAttendances.find(sa =>
        String(sa.sessionId) === String(att.sessionId) && sa.role === 'platform_coordinator' && sa.date === attDay
      );

      if (!map[coordName]) {
        // البحث عن معلومات المنسق الإضافية
        const coordInfo = platformCoordinators.find(c => normalizeAr(c.name) === normalizeAr(coordName));
        map[coordName] = {
          coordinator: coordName,
          phone: coordInfo?.phone || currentUser?.phone || '',
          national_id: coordInfo?.national_id || currentUser?.national_id || '',
          isUnassigned: coordName === 'غير معين لمنسق',
          sessions: [],
          totalSessions: 0,
          totalHours: 0,
          workDays: 0,
        };
      }

      map[coordName].sessions.push({
        sessionId: session.id,
        sessionNo: session.session_no,
        currentCoordinator: session.coordinator || '',
        mohfez: session.mohfez || '',
        rowaq: session.rowaq,
        level: session.level,
        date: att.date,
        presentCount,
        duration,
        coordinatorJoinedAt: joined ? joined.joinedAt : null,
      });

      map[coordName].totalSessions++;
      if (joined) map[coordName].joinedCount = (map[coordName].joinedCount || 0) + 1;
      map[coordName].totalHours += duration;
      // كل 3 ساعات = 1 يوم عمل
      map[coordName].workDays = map[coordName].totalHours / 3;
    });

    return Object.values(map).sort((a, b) => {
      if (a.isUnassigned) return 1;
      if (b.isUnassigned) return -1;
      return a.coordinator.localeCompare(b.coordinator, 'ar');
    });
  }, [attendances, staffAttendances, platformSessions, platformStudents, platformCoordinators, users, selYear, selMonth, selCoord, selRowaq, selMohfez, isPlatformCoordinator, currentUser]);

  // إجماليات عامة
  const grandHours    = reportData.reduce((s, r) => s + r.totalHours, 0);
  const grandSessions = reportData.reduce((s, r) => s + r.totalSessions, 0);
  const grandWorkDays = grandHours / 3;

  // تعيين منسق لحلقة معينة بسرعة
  const handleAssignSession = async (sessionId, coordinatorName) => {
    try {
      await updatePlatformSession(sessionId, { coordinator: coordinatorName });
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تعيين المنسق للحلقة');
    }
  };

  // تصدير إكسيل بصيغة XLSX
  const handleExport = () => {
    if (reportData.length === 0) return;

    // 1. ورقة ملخص أيام عمل المنسقين
    const summaryData = reportData.map((c, idx) => ({
      'م': idx + 1,
      'اسم المنسق': c.coordinator,
      'الهاتف': c.phone || '-',
      'الرقم القومي': c.national_id || '-',
      'إجمالي الحلقات المشرف عليها': c.totalSessions,
      'إجمالي الساعات': Number(c.totalHours.toFixed(1)),
      'أيام العمل المحتسبة (الساعات ÷ 3)': Number(c.workDays.toFixed(2)),
      'أيام دخول المنسق': c.joinedCount || 0,
    }));

    // سطر المجموع النهائي
    summaryData.push({
      'م': 'المجموع',
      'اسم المنسق': `إجمالي المنسقين: ${reportData.length}`,
      'الهاتف': '',
      'الرقم القومي': '',
      'إجمالي الحلقات المشرف عليها': grandSessions,
      'إجمالي الساعات': Number(grandHours.toFixed(1)),
      'أيام العمل المحتسبة (الساعات ÷ 3)': Number(grandWorkDays.toFixed(2)),
      'أيام دخول المنسق': reportData.reduce((s, r) => s + (r.joinedCount || 0), 0),
    });

    // 2. ورقة تفاصيل كل حلقة للمنسق
    const detailsData = [];
    let dIdx = 1;
    reportData.forEach(c => {
      c.sessions.forEach(s => {
        const bd = durationBadge(s.duration);
        detailsData.push({
          'م': dIdx++,
          'اسم المنسق المشرف': c.coordinator,
          'رقم الحلقة': s.sessionNo || '-',
          'المحفظ': s.mohfez || '-',
          'الرواق': s.rowaq || '-',
          'المستوى': s.level || '-',
          'التاريخ': s.date || '-',
          'عدد الحضور الفعلي': s.presentCount,
          'مدة الحلقة المستحقة': bd.label,
          'الساعات': s.duration,
          'نصيب الحلقة من أيام العمل (المدة ÷ 3)': Number((s.duration / 3).toFixed(2)),
          'دخول المنسق للحلقة': s.coordinatorJoinedAt ? new Date(s.coordinatorJoinedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'غير مسجل',
        });
      });
    });

    const filenamePrefix = isPlatformCoordinator
      ? `تقرير_أيام_عمل_وساعات_المنسق_${currentUser?.name || 'منسق'}`
      : 'تقرير_أيام_عمل_المنسقين';

    exportMultiSheetToXLSX([
      { sheetName: 'ملخص أيام عمل المنسقين', data: summaryData },
      { sheetName: 'تفاصيل حلقات المنسقين', data: detailsData }
    ], `${filenamePrefix}_${selMonth}-${selYear}`);
  };

  if (!hasPermission('reports', 'view')) {
    return (
      <div className="management-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="box-card" style={{ textAlign: 'center', maxWidth: '500px', padding: '40px', border: '1px solid rgba(239,68,68,.3)' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '15px' }}>عذراً، ليس لديك صلاحية لعرض هذا القسم</h3>
        </div>
      </div>
    );
  }

  const monthLabel = `${MONTHS_AR[parseInt(selMonth, 10) - 1]} ${selYear}`;

  return (
    <div className="management-page" dir="rtl">

      {/* رأس الصفحة */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ textAlign: 'center', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Calendar size={26} style={{ color: 'var(--accent-primary)' }} />
          {isPlatformCoordinator 
            ? `تقرير حساب ساعات وأيام عمل المنسق (${currentUser?.name || 'المنسق'})`
            : 'تقرير حساب أيام عمل المنسقين'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '6px', fontSize: '13px' }}>
          {isPlatformCoordinator
            ? 'يُحتسب كل 3 ساعات للحلقات والمحفظين الذين تشرف عليهم من واقع الحضور الفعلي كيوم عمل واحد لك (الساعات ÷ 3)'
            : 'يُحتسب كل 3 ساعات للحلقات التي يشرف عليها المنسق من واقع غياب الحلقة الفعلي كيوم عمل واحد (وفق معيار الأزهر الشريف)'}
        </p>
      </div>

      {/* بطاقات الإحصاءات العلوية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { icon: <BarChart2 size={26} />, color: '#3b82f6', value: grandSessions, label: isPlatformCoordinator ? 'إجمالي الحلقات المشرف عليها' : 'إجمالي الحلقات المنعقدة' },
          { icon: <Clock size={26} />,     color: '#f59e0b', value: grandHours.toFixed(1) + ' ساعة', label: isPlatformCoordinator ? 'إجمالي ساعات الحلقات' : 'إجمالي الساعات المنفذة' },
          { icon: <CheckCircle size={26} />, color: '#10b981', value: formatWorkDays(grandWorkDays), label: isPlatformCoordinator ? 'أيام العمل المحتسبة لك' : 'إجمالي أيام العمل المحتسبة' },
          { icon: <Users size={26} />,     color: '#8b5cf6', value: isPlatformCoordinator ? (currentUser?.name || 'المنسق') : reportData.length, label: isPlatformCoordinator ? 'المنسق المشرف' : 'عدد المنسقين', small: isPlatformCoordinator },
          { icon: <BookOpen size={26} />,  color: '#ec4899', value: monthLabel, label: 'الفترة المحددة', small: true },
        ].map((c, i) => (
          <div key={i} className="box-card" style={{ padding: '20px', borderTop: `3px solid ${c.color}`, textAlign: 'center' }}>
            <div style={{ color: c.color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{c.icon}</div>
            <div style={{ fontSize: c.small ? '16px' : '26px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر البحث والتحكم */}
      <div className="search-section box-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={15} /> فلاتر البحث والخيارات
        </h3>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '110px' }}>
            <label>السنة</label>
            <select className="form-select" value={selYear} onChange={e => setSelYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '130px' }}>
            <label>الشهر</label>
            <select className="form-select" value={selMonth} onChange={e => setSelMonth(e.target.value)}>
              {MONTHS_AR.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
            </select>
          </div>
          {!isPlatformCoordinator && (
            <div className="form-group" style={{ minWidth: '190px', flex: 1 }}>
              <label>المنسق</label>
              <select className="form-select" value={selCoord} onChange={e => setSelCoord(e.target.value)}>
                <option value="">كل المنسقين</option>
                {coordinatorList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ minWidth: '190px', flex: 1 }}>
            <label>{isPlatformCoordinator ? 'المحفظ المشرف عليه' : 'المحفظ'}</label>
            <select className="form-select" value={selMohfez} onChange={e => setSelMohfez(e.target.value)}>
              <option value="">كل المحفظين</option>
              {mohfezList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '190px', flex: 1 }}>
            <label>الرواق</label>
            <select className="form-select" value={selRowaq} onChange={e => setSelRowaq(e.target.value)}>
              <option value="">كل الأروقة</option>
              {rowaqList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleExport} 
              disabled={reportData.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} /> تصدير إكسيل (XLSX)
            </button>
            <button 
              className="btn btn-outline" 
              onClick={() => { setSelCoord(''); setSelRowaq(''); setSelMohfez(''); }}
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      </div>

      {/* معيار الاحتساب التوضيحي */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px 18px',
        marginBottom: '20px', fontSize: '13px', color: 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)', lineHeight: '1.9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
          <AlertCircle size={17} />
          معيار احتساب أيام عمل المنسقين:
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          • <strong>القاعدة الأساسية:</strong> كل <strong>3 ساعات</strong> من ساعات الحلقات التي يشرف عليها المنسق تحتسب <strong>يوماً واحداً</strong> من أيام العمل (العمل = الساعات ÷ 3).<br />
          • <strong>احتساب وقت الحلقة:</strong> يُحسب وقت كل حلقة تلقائياً من واقع كشف الحضور الفعلي المسجل ومستوى الرواق وفق معيار الجامع الأزهر (0.5 س / 1 س / 1.5 س).<br />
          • <strong>ربط الحلقات:</strong> يمكن تعيين وتعديل المنسق المشرف على كل حلقة مباشرة من جدول تفاصيل الحلقات بالأسفل أو من صفحة إدارة حلقات المنصة.
        </div>
      </div>

      {/* جدول النتائج */}
      <div className="table-wrapper box-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0 }}>
            كشف أيام عمل المنسقين — {monthLabel}
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            إجمالي السجلات: {reportData.length} منسق | اضغط على "عرض الحلقات" لمشاهدة تفاصيل جلسات كل منسق
          </span>
        </div>

        <table className="management-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '50px' }}>م</th>
              <th>اسم المنسق</th>
              <th style={{ textAlign: 'center' }}>الهاتف / الرقم القومي</th>
              <th style={{ textAlign: 'center' }}>عدد الحلقات المنعقدة</th>
              <th style={{ textAlign: 'center' }}>إجمالي الساعات</th>
              <th style={{ textAlign: 'center', color: '#10b981' }}>أيام العمل المحتسبة</th>
              <th style={{ textAlign: 'center', width: '150px' }}>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {reportData.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '50px' }}>
                  {isPlatformCoordinator ? (
                    <>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        لا توجد حلقات أو جلسات مسجلة لك خلال هذا الشهر ({monthLabel}).
                      </div>
                      <small style={{ fontSize: '12px' }}>تأكد من اختيار الشهر المطلوب، أو التحقق من تعيين الحلقات لإشرافك في صفحة الحلقات.</small>
                    </>
                  ) : (
                    'لا توجد جلسات غياب مسجلة مطابقة للفلاتر المحددة في هذا الشهر.'
                  )}
                </td>
              </tr>
            ) : (
              reportData.map((row, index) => (
                <CoordinatorRow 
                  key={row.coordinator} 
                  row={row} 
                  index={index} 
                  canEdit={canEdit}
                  platformCoordinators={platformCoordinators}
                  onAssignSession={handleAssignSession}
                />
              ))
            )}
          </tbody>
          {reportData.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold', borderTop: '2px solid var(--accent-primary)' }}>
                <td colSpan="3" style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px' }}>
                  الإجمالي العام ({reportData.length} منسق)
                </td>
                <td style={{ textAlign: 'center', fontSize: '14px' }}>{grandSessions} حلقة</td>
                <td style={{ textAlign: 'center', fontSize: '14px', color: 'var(--accent-primary)' }}>
                  {grandHours.toFixed(1)} ساعة
                </td>
                <td style={{ textAlign: 'center', fontSize: '15px', color: '#10b981' }}>
                  {formatWorkDays(grandWorkDays)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

    </div>
  );
}

export default CoordinatorWorkdaysReport;
