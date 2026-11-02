import React, { useState, useMemo } from 'react';
import { 
  Users, UserCheck, UserX, AlertTriangle, Search, Download, 
  Calendar, Clock, Filter, CheckCircle2, XCircle, TrendingUp
} from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportMultiSheetToXLSX } from '../utils/xlsxHelper';
import { isSessionTaughtByMohfez } from '../utils/userScopeHelper';

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

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// دالة التحقق من إشراف المنسق على الحلقة
const isSessionSupervisedByCoordinator = (session, user, platformCoordinators = [], users = []) => {
  if (!session || !user) return false;

  const userNormName = normalizeAr(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // 1. التطابق المباشر مع حقل المنسق المشرف في الحلقة
  if (session.coordinator && userNormName && normalizeAr(session.coordinator) === userNormName) {
    return true;
  }

  // 2. التطابق عبر سجلات منسقي المنصة
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

  // 3. التطابق عبر userSession
  if (user.userSession) {
    const sId = String(session.id);
    const sNo = String(session.session_no || '');
    const sName = String(session.session_name || '');
    const uS = String(user.userSession);
    if (sId === uS || sNo === uS || sName === uS) {
      return true;
    }
  }

  // 4. التطابق عبر جدول المستخدمين
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

// شريط نسبة الحضور الملون
const AttendanceProgressBar = ({ rate }) => {
  let color = '#10b981'; // أخضر
  if (rate < 50) color = '#ef4444'; // أحمر
  else if (rate < 75) color = '#f59e0b'; // برتقالي

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
      <div style={{
        flex: 1,
        height: '8px',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, rate))}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '4px',
          transition: 'width 0.4s ease'
        }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 'bold', color, width: '38px', textAlign: 'left' }}>
        {rate.toFixed(0)}%
      </span>
    </div>
  );
};

// بادج حالة الالتزام
const StatusBadge = ({ absentCount, rate }) => {
  if (absentCount === 0) {
    return (
      <span style={{
        background: 'rgba(16,185,129,0.15)', color: '#10b981',
        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
      }}>
        ملتزم تماماً (100%)
      </span>
    );
  }
  if (absentCount >= 5 || rate < 50) {
    return (
      <span style={{
        background: 'rgba(239,68,68,0.15)', color: '#ef4444',
        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
      }}>
        تجاوز الغياب (حرمان)
      </span>
    );
  }
  if (absentCount >= 3 || rate < 75) {
    return (
      <span style={{
        background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
      }}>
        إنذار غياب
      </span>
    );
  }
  return (
    <span style={{
      background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
      padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
    }}>
      حضور منتظم
    </span>
  );
};

// مكون صف الدارس القابل للتوسيع
function StudentRow({ row, index }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr 
        style={{ 
          cursor: 'pointer', 
          background: open ? 'var(--bg-secondary)' : 'inherit',
          transition: 'background 0.15s'
        }}
        onClick={() => setOpen(o => !o)}
      >
        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
        <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>
              {open ? '▲' : '▼'}
            </span>
            <span>{row.studentName}</span>
          </div>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '8px', fontSize: '12px' }}>
            {row.country || '-'}
          </span>
        </td>
        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
          {row.sessionNo}
        </td>
        <td style={{ textAlign: 'center', fontSize: '12px' }}>
          {row.rowaq || '-'} {row.level ? `(${row.level})` : ''}
        </td>
        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {row.mohfez || '-'}
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{
            background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
            padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px'
          }}>
            {row.totalSessions}
          </span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{
            background: 'rgba(16,185,129,0.15)', color: '#10b981',
            padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px'
          }}>
            {row.presentCount}
          </span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{
            background: row.absentCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
            color: row.absentCount > 0 ? '#ef4444' : '#6b7280',
            padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px'
          }}>
            {row.absentCount}
          </span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <AttendanceProgressBar rate={row.attendanceRate} />
        </td>
        <td style={{ textAlign: 'center' }}>
          <StatusBadge absentCount={row.absentCount} rate={row.attendanceRate} />
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan="11" style={{ padding: 0 }}>
            <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', padding: '16px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  سجل حضور وغياب الدارس: {row.studentName} — (حلقة: {row.sessionNo} | منسق: {row.coordinator || '-'})
                </span>
                {(row.phone || row.passport_no) && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    الهاتف: {row.phone || '-'} | الرقم القومي/الجواز: {row.passport_no || '-'}
                  </span>
                )}
              </div>

              {row.history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  لا توجد جلسات مسجلة لهذا الدارس في الفترة المحددة.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>م</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>التاريخ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>اليوم</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>رقم الحلقة</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>المحفظ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.history
                        .slice()
                        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                        .map((h, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', direction: 'ltr', fontWeight: 'bold' }}>{h.date}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{h.dayName}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{row.sessionNo}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{row.mohfez || '-'}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {h.isPresent ? (
                                <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                                  <CheckCircle2 size={14} /> حاضر
                                </span>
                              ) : (
                                <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                                  <XCircle size={14} /> غائب
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── مكوّن الصفحة الرئيسي ──────────────────────────────────────────────────────
function StudentAbsenceReport() {
  const { 
    platformSessions = [], 
    platformStudents = [], 
    platformCoordinators = [], 
    platformMohfezs = [],
    users = [], 
    attendances = []
  } = useAppData();

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser?.role || 'admin';
  const isPlatformCoordinator = role === 'platform_coordinator';
  const isPlatformMohfez = role === 'platform_mohfez' || role === 'mohfez';

  const today = new Date();
  const [selYear, setSelYear] = useState(String(today.getFullYear()));
  const [selMonth, setSelMonth] = useState('all'); // 'all' أو 1..12
  const [selSession, setSelSession] = useState('');
  const [selRowaq, setSelRowaq] = useState('');
  const [selMohfez, setSelMohfez] = useState('');
  const [selCoord, setSelCoord] = useState('');
  const [selStatus, setSelStatus] = useState('all'); // all, absent_only, warning_only (>=3), danger_only (>=5), perfect
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('summary'); // summary, daily_log, warnings

  // تصفية الحلقات الخاضعة لمجال المستخدم
  const scopedSessions = useMemo(() => {
    if (isPlatformCoordinator) {
      return platformSessions.filter(s => isSessionSupervisedByCoordinator(s, currentUser, platformCoordinators, users));
    }
    if (isPlatformMohfez) {
      return platformSessions.filter(s => isSessionTaughtByMohfez(s, currentUser, platformMohfezs, users));
    }
    return platformSessions;
  }, [platformSessions, isPlatformCoordinator, isPlatformMohfez, currentUser, platformCoordinators, platformMohfezs, users]);

  // قائمة السنوات المتوفرة
  const years = useMemo(() => {
    const ys = new Set([String(today.getFullYear())]);
    attendances.forEach(a => {
      const d = (a.date || '').replace(/\//g, '-');
      const y = d.split('-')[0];
      if (y && y.length === 4) ys.add(y);
    });
    return Array.from(ys).sort().reverse();
  }, [attendances, today]);

  // قوائم الفلاتر المتاحة
  const sessionList = useMemo(() => {
    return scopedSessions.map(s => ({
      id: String(s.id),
      no: s.session_no || s.id,
      label: `حلقة ${s.session_no || s.id} - ${s.rowaq || ''} (${s.mohfez || ''})`
    })).sort((a, b) => String(a.no).localeCompare(String(b.no)));
  }, [scopedSessions]);

  const rowaqList = useMemo(() => {
    const rws = new Set();
    scopedSessions.forEach(s => { if (s.rowaq) rws.add(s.rowaq); });
    return Array.from(rws).sort();
  }, [scopedSessions]);

  const mohfezList = useMemo(() => {
    const names = new Set();
    scopedSessions.forEach(s => { if (s.mohfez) names.add(s.mohfez); });
    return Array.from(names).sort();
  }, [scopedSessions]);

  const coordinatorList = useMemo(() => {
    const names = new Set();
    scopedSessions.forEach(s => { if (s.coordinator) names.add(s.coordinator); });
    return Array.from(names).sort();
  }, [scopedSessions]);

  // حساب معالجة بيانات الحضور والغياب للدارسين
  const reportData = useMemo(() => {
    // 1. تصفية سجلات الحضور حسب السنة والشهر
    const filteredAttendances = attendances.filter(att => {
      if (!att.isPlatform) return false;
      const d = (att.date || '').replace(/\//g, '-');
      const [y, m] = d.split('-');
      if (selYear && y !== selYear) return false;
      if (selMonth !== 'all' && String(parseInt(m, 10)) !== String(selMonth)) return false;
      return true;
    });

    // 2. تجميع السجلات حسب كل دارس
    // مفتاح التجميع: studentId
    const studentMap = {};

    // تهيئة جميع دارسي الحلقات ذات الصلة حتى يظهر من لم يُسجل له حضور أيضاً
    platformStudents.forEach(st => {
      if (st.isArchived) return;
      const session = scopedSessions.find(s => 
        String(s.id) === String(st.session_id) || 
        String(s.session_no) === String(st.session_id) ||
        String(s.session_name) === String(st.session_id)
      );
      if (!session) return; // ليس في نطاق الحلقات المتاحة لهذا المستخدم

      // فلاتر البحث الأولية
      if (selSession && String(session.id) !== String(selSession) && String(session.session_no) !== String(selSession)) return;
      if (selRowaq && session.rowaq !== selRowaq) return;
      if (selMohfez && session.mohfez !== selMohfez) return;
      if (selCoord && session.coordinator !== selCoord) return;

      studentMap[String(st.id)] = {
        studentId: String(st.id),
        studentName: st.name || 'بدون اسم',
        country: st.country || '-',
        // المحفظ لا يطّلع على الهاتف أو رقم الجواز/الهوية الخاص بالدارس
        phone: isPlatformMohfez ? '' : (st.phone || '-'),
        passport_no: isPlatformMohfez ? '' : (st.passport_no || st.national_id || '-'),
        sessionId: session.id,
        sessionNo: session.session_no || session.id,
        rowaq: session.rowaq || '-',
        level: session.level || '',
        mohfez: session.mohfez || '-',
        coordinator: session.coordinator || '-',
        totalSessions: 0,
        presentCount: 0,
        absentCount: 0,
        attendanceRate: 100,
        history: []
      };
    });

    // ملء بيانات الحضور والغياب من واقع سجلات attendances
    filteredAttendances.forEach(att => {
      const session = scopedSessions.find(s => String(s.id) === String(att.sessionId));
      if (!session) return;

      if (selSession && String(session.id) !== String(selSession) && String(session.session_no) !== String(selSession)) return;
      if (selRowaq && session.rowaq !== selRowaq) return;
      if (selMohfez && session.mohfez !== selMohfez) return;
      if (selCoord && session.coordinator !== selCoord) return;

      const dateObj = new Date(att.date);
      const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = !isNaN(dateObj.getDay()) ? dayNames[dateObj.getDay()] : '';

      (att.records || []).forEach(rec => {
        const sId = String(rec.studentId);
        // إذا كان الدارس موجوداً في القائمة
        if (studentMap[sId]) {
          studentMap[sId].totalSessions++;
          if (rec.isPresent) {
            studentMap[sId].presentCount++;
          } else {
            studentMap[sId].absentCount++;
          }
          studentMap[sId].history.push({
            date: att.date,
            dayName,
            isPresent: !!rec.isPresent
          });
        }
      });
    });

    // حساب النسب والتصفية النهائية (حسب الحالة والبحث)
    const allStudentsList = Object.values(studentMap).map(item => {
      const rate = item.totalSessions > 0 ? (item.presentCount / item.totalSessions) * 100 : 100;
      return {
        ...item,
        attendanceRate: rate
      };
    });

    return allStudentsList.filter(item => {
      // فلتر مستوى الالتزام
      if (selStatus === 'absent_only' && item.absentCount < 1) return false;
      if (selStatus === 'warning_only' && (item.absentCount < 3 && item.attendanceRate >= 75)) return false;
      if (selStatus === 'danger_only' && (item.absentCount < 5 && item.attendanceRate >= 50)) return false;
      if (selStatus === 'perfect' && item.absentCount > 0) return false;

      // بحث بالاسم أو الهاتف أو الدولة أو الحلقة
      if (searchQuery) {
        const q = normalizeAr(searchQuery);
        const matchName = normalizeAr(item.studentName).includes(q);
        const matchPhone = !isPlatformMohfez && String(item.phone).includes(q);
        const matchCountry = normalizeAr(item.country).includes(q);
        const matchSession = String(item.sessionNo).includes(q);
        if (!matchName && !matchPhone && !matchCountry && !matchSession) return false;
      }

      return true;
    }).sort((a, b) => {
      // الترتيب الافتراضي: الأكثر غياباً في البداية
      if (b.absentCount !== a.absentCount) return b.absentCount - a.absentCount;
      return a.studentName.localeCompare(b.studentName, 'ar');
    });

  }, [attendances, platformStudents, scopedSessions, isPlatformMohfez, selYear, selMonth, selSession, selRowaq, selMohfez, selCoord, selStatus, searchQuery]);

  // إحصائيات عامة
  const totalStudentsCount = reportData.length;
  const totalPresentCount  = reportData.reduce((s, r) => s + r.presentCount, 0);
  const totalAbsentCount   = reportData.reduce((s, r) => s + r.absentCount, 0);
  const totalRecordedAtts  = totalPresentCount + totalAbsentCount;
  const overallRate        = totalRecordedAtts > 0 ? (totalPresentCount / totalRecordedAtts) * 100 : 100;
  const warningStudentsCount = reportData.filter(r => r.absentCount >= 3 || r.attendanceRate < 75).length;
  const dangerStudentsCount  = reportData.filter(r => r.absentCount >= 5 || r.attendanceRate < 50).length;

  // سجل الغياب التفصيلي (لكل يوم غياب)
  const dailyAbsenceLog = useMemo(() => {
    const log = [];
    reportData.forEach(st => {
      st.history.forEach(h => {
        if (!h.isPresent) {
          log.push({
            studentName: st.studentName,
            country: st.country,
            phone: st.phone,
            sessionNo: st.sessionNo,
            rowaq: st.rowaq,
            mohfez: st.mohfez,
            coordinator: st.coordinator,
            date: h.date,
            dayName: h.dayName,
            totalAbsencesSoFar: st.absentCount
          });
        }
      });
    });
    return log.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [reportData]);

  // تصدير إكسيل متعدد الأوراق
  const handleExport = () => {
    if (reportData.length === 0) return;

    // 1. ورقة ملخص غياب الدارسين
    const summarySheet = reportData.map((st, i) => ({
      'م': i + 1,
      'اسم الدارس': st.studentName,
      'الدولة': st.country,
      'رقم الهاتف': st.phone,
      'رقم الحلقة': st.sessionNo,
      'الرواق': st.rowaq,
      'المستوى': st.level || '-',
      'المحفظ': st.mohfez,
      'المنسق المشرف': st.coordinator,
      'إجمالي الجلسات': st.totalSessions,
      'أيام الحضور': st.presentCount,
      'أيام الغياب': st.absentCount,
      'نسبة الحضور %': `${st.attendanceRate.toFixed(1)}%`,
      'حالة الالتزام': st.absentCount >= 5 ? 'تجاوز الغياب (حرمان)' : st.absentCount >= 3 ? 'إنذار غياب' : st.absentCount === 0 ? 'ملتزم 100%' : 'حضور منتظم'
    }));

    // سطر المجموع
    summarySheet.push({
      'م': 'المجموع',
      'اسم الدارس': `إجمالي الدارسين: ${totalStudentsCount}`,
      'الدولة': '',
      'رقم الهاتف': '',
      'رقم الحلقة': '',
      'الرواق': '',
      'المستوى': '',
      'المحفظ': '',
      'المنسق المشرف': '',
      'إجمالي الجلسات': totalRecordedAtts,
      'أيام الحضور': totalPresentCount,
      'أيام الغياب': totalAbsentCount,
      'نسبة الحضور %': `${overallRate.toFixed(1)}%`,
      'حالة الالتزام': `المعرضون للإنذار والحرمان: ${warningStudentsCount}`
    });

    // 2. ورقة سجل أيام الغياب التفصيلي
    const logSheet = dailyAbsenceLog.map((log, i) => ({
      'م': i + 1,
      'التاريخ': log.date,
      'اليوم': log.dayName,
      'اسم الدارس الغائب': log.studentName,
      'الدولة': log.country,
      'الهاتف': log.phone,
      'رقم الحلقة': log.sessionNo,
      'الرواق': log.rowaq,
      'المحفظ': log.mohfez,
      'المنسق المشرف': log.coordinator,
      'إجمالي غيابات الدارس': log.totalAbsencesSoFar
    }));

    const periodLabel = selMonth === 'all' ? `سنة_${selYear}` : `شهر_${selMonth}-${selYear}`;
    const userRolePrefix = isPlatformCoordinator ? `منسق_${currentUser?.name || ''}_` : '';
    exportMultiSheetToXLSX([
      { sheetName: 'ملخص غياب وحضور الدارسين', data: summarySheet },
      { sheetName: 'سجل الغياب اليومي التفصيلي', data: logSheet.length > 0 ? logSheet : [{ 'ملاحظة': 'لا توجد غيابات مسجلة' }] }
    ], `تقرير_غياب_الدارسين_${userRolePrefix}${periodLabel}`);
  };

  const monthText = selMonth === 'all' ? `كامل شهور ${selYear}` : `${MONTHS_AR[parseInt(selMonth, 10) - 1]} ${selYear}`;

  return (
    <div className="management-page" dir="rtl">

      {/* رأس الصفحة */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ textAlign: 'center', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <UserX size={26} style={{ color: '#ef4444' }} />
          تقرير متابعة غياب وحضور الدارسين
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '6px', fontSize: '13px' }}>
          {isPlatformCoordinator
            ? `متابعة دقيقة لنسب الحضور وسجلات الغياب للدارسين في الحلقات المشرف عليها (${currentUser?.name || 'المنسق'})`
            : isPlatformMohfez
            ? `متابعة حضور وغياب دارسي حلقاتك المسجلة (${currentUser?.name || 'المحفظ'})`
            : 'متابعة شاملة لنسب الحضور وسجلات الغياب لدارسي الحلقات ورصد حالات الإنذار والحرمان'}
        </p>
      </div>

      {/* بطاقات الإحصاءات العلوية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { icon: <Users size={26} />, color: '#3b82f6', value: totalStudentsCount, label: 'إجمالي الدارسين بالتقرير' },
          { icon: <UserCheck size={26} />, color: '#10b981', value: totalPresentCount, label: 'إجمالي مرات الحضور' },
          { icon: <UserX size={26} />, color: '#ef4444', value: totalAbsentCount, label: 'إجمالي مرات الغياب' },
          { icon: <TrendingUp size={26} />, color: '#8b5cf6', value: `${overallRate.toFixed(1)}%`, label: 'نسبة الحضور العامة' },
          { icon: <AlertTriangle size={26} />, color: '#f59e0b', value: warningStudentsCount, label: 'دارسون بإنذار (≥3 غيابات)' },
          { icon: <Calendar size={26} />, color: '#ec4899', value: monthText, label: 'الفترة المحددة', small: true },
        ].map((c, i) => (
          <div key={i} className="box-card" style={{ padding: '20px', borderTop: `3px solid ${c.color}`, textAlign: 'center' }}>
            <div style={{ color: c.color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{c.icon}</div>
            <div style={{ fontSize: c.small ? '15px' : '26px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر البحث والخيارات */}
      <div className="search-section box-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} /> فلاتر البحث وخيارات العرض
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('summary')}
              className={`btn ${activeTab === 'summary' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              ملخص الدارسين
            </button>
            <button
              onClick={() => setActiveTab('daily_log')}
              className={`btn ${activeTab === 'daily_log' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              سجل الغياب اليومي ({dailyAbsenceLog.length})
            </button>
            <button
              onClick={() => { setActiveTab('summary'); setSelStatus('warning_only'); }}
              className={`btn ${selStatus === 'warning_only' ? 'btn-danger' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: '12px', borderColor: '#f59e0b', color: selStatus === 'warning_only' ? '#fff' : '#f59e0b' }}
            >
              المعرضون للإنذار ({warningStudentsCount})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* البحث السريع */}
          <div className="form-group" style={{ minWidth: '200px', flex: 1 }}>
            <label>بحث بالاسم / الدولة / الهاتف</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="اكتب اسم الدارس أو الدولة أو الهاتف..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingRight: '32px' }}
              />
              <Search size={15} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ minWidth: '100px' }}>
            <label>السنة</label>
            <select className="form-select" value={selYear} onChange={e => setSelYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '130px' }}>
            <label>الشهر</label>
            <select className="form-select" value={selMonth} onChange={e => setSelMonth(e.target.value)}>
              <option value="all">كل الشهور</option>
              {MONTHS_AR.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '180px', flex: 1 }}>
            <label>الحلقة</label>
            <select className="form-select" value={selSession} onChange={e => setSelSession(e.target.value)}>
              <option value="">كل الحلقات ({scopedSessions.length})</option>
              {sessionList.map(s => <option key={s.id} value={s.no}>{s.label}</option>)}
            </select>
          </div>

          {!isPlatformMohfez && (
            <div className="form-group" style={{ minWidth: '160px', flex: 1 }}>
              <label>المحفظ</label>
              <select className="form-select" value={selMohfez} onChange={e => setSelMohfez(e.target.value)}>
                <option value="">كل المحفظين</option>
                {mohfezList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {!isPlatformCoordinator && (
            <div className="form-group" style={{ minWidth: '160px', flex: 1 }}>
              <label>المنسق المشرف</label>
              <select className="form-select" value={selCoord} onChange={e => setSelCoord(e.target.value)}>
                <option value="">كل المنسقين</option>
                {coordinatorList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ minWidth: '150px' }}>
            <label>الرواق</label>
            <select className="form-select" value={selRowaq} onChange={e => setSelRowaq(e.target.value)}>
              <option value="">كل الأروقة</option>
              {rowaqList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '170px' }}>
            <label>حالة الغياب</label>
            <select className="form-select" value={selStatus} onChange={e => setSelStatus(e.target.value)}>
              <option value="all">جميع الحالات</option>
              <option value="absent_only">لديهم غياب (≥ 1)</option>
              <option value="warning_only">إنذار غياب (≥ 3)</option>
              <option value="danger_only">تجاوز حرمان (≥ 5)</option>
              <option value="perfect">حضور كامل (100%)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isPlatformMohfez && (
            <button 
              className="btn btn-primary" 
              onClick={handleExport} 
              disabled={reportData.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} /> تصدير إكسيل
            </button>
            )}
            <button 
              className="btn btn-outline" 
              onClick={() => {
                setSelSession('');
                setSelRowaq('');
                setSelMohfez('');
                setSelCoord('');
                setSelStatus('all');
                setSearchQuery('');
                setSelMonth('all');
              }}
            >
              إعادة ضبط
            </button>
          </div>
        </div>
      </div>

      {/* معيار وضوابط الغياب التوضيحية */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px 18px',
        marginBottom: '20px', fontSize: '13px', color: 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)', lineHeight: '1.9'
      }}>
        <strong style={{ color: 'var(--accent-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <AlertTriangle size={16} /> ضوابط الغياب والإنذارات المعتمدة:
        </strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 30px' }}>
          <span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>• حضور منتظم: </span>
            نسبة حضور 75% فما فوق مع أقل من 3 أيام غياب.
          </span>
          <span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>• إنذار أول/ثانٍ: </span>
            تراكم 3 إلى 4 أيام غياب أو انخفاض نسبة الحضور دون 75%.
          </span>
          <span>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>• تجاوز الحد الأقصى (حرمان): </span>
            تراكم 5 أيام غياب فما فوق يستوجب مراجعة المنسق المشرف وتجميد القيد.
          </span>
        </div>
      </div>

      {/* المحتوى حسب التبويب النشط */}
      {activeTab === 'summary' && (
        <div className="box-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Users size={18} style={{ color: 'var(--accent-primary)' }} />
              ملخص متابعة الدارسين — {monthText}
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              إجمالي النتائج: {reportData.length} دارس | اضغط على أي سطر لعرض سجل التواريخ المفصل
            </span>
          </div>

          <div className="table-wrapper">
            <table className="management-table">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['م', 'اسم الدارس', 'الدولة', 'رقم الحلقة', 'الرواق', 'المحفظ', 'الجلسات', 'الحضور', 'الغياب', 'نسبة الحضور', 'الحالة'].map(h => (
                    <th key={h} style={{ textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>
                      لا توجد بيانات غياب أو حضور مطابقة للفلاتر المحددة في هذا الشهر.<br />
                      <small style={{ fontSize: '12px' }}>تأكد من تسجيل الحضور في صفحة كل حلقة أو تغيير معايير البحث.</small>
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, idx) => (
                    <StudentRow key={row.studentId} row={row} index={idx} />
                  ))
                )}

                {reportData.length > 0 && (
                  <tr style={{
                    background: 'linear-gradient(90deg, rgba(59,130,246,0.12), rgba(16,185,129,0.1))',
                    fontWeight: 'bold', borderTop: '2px solid var(--accent-primary)'
                  }}>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--accent-primary)', fontSize: '14px' }}>
                      الإجمالي العام ({reportData.length} دارس)
                    </td>
                    <td style={{ textAlign: 'center', color: '#3b82f6', fontSize: '14px' }}>
                      {totalRecordedAtts}
                    </td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontSize: '14px' }}>
                      {totalPresentCount}
                    </td>
                    <td style={{ textAlign: 'center', color: '#ef4444', fontSize: '14px' }}>
                      {totalAbsentCount}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-primary)', fontSize: '14px' }}>
                      <AttendanceProgressBar rate={overallRate} />
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px' }}>
                      إنذار: {warningStudentsCount} | حرمان: {dangerStudentsCount}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'daily_log' && (
        <div className="box-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Clock size={18} style={{ color: '#ef4444' }} />
              سجل الغياب اليومي التفصيلي للدارسين
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              إجمالي حالات الغياب المسجلة: {dailyAbsenceLog.length} حالة
            </span>
          </div>

          <div className="table-wrapper">
            <table className="management-table">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['م', 'التاريخ', 'اليوم', 'اسم الدارس', 'الدولة', 'الهاتف', 'رقم الحلقة', 'المحفظ', 'المنسق المشرف', 'مجموع غياباته'].map(h => (
                    <th key={h} style={{ textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyAbsenceLog.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '50px' }}>
                      لا توجد أي حالات غياب مسجلة في الفترة المحددة.
                    </td>
                  </tr>
                ) : (
                  dailyAbsenceLog.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', direction: 'ltr' }}>{log.date}</td>
                      <td style={{ textAlign: 'center' }}>{log.dayName}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{log.studentName}</td>
                      <td style={{ textAlign: 'center' }}>{log.country || '-'}</td>
                      <td style={{ textAlign: 'center', direction: 'ltr' }}>{log.phone || '-'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{log.sessionNo}</td>
                      <td style={{ textAlign: 'center' }}>{log.mohfez || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{log.coordinator || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: log.totalAbsencesSoFar >= 5 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                          color: log.totalAbsencesSoFar >= 5 ? '#ef4444' : '#f59e0b',
                          padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px'
                        }}>
                          {log.totalAbsencesSoFar} غياب
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default StudentAbsenceReport;
