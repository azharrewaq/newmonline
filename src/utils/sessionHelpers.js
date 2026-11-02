/**
 * sessionHelpers.js
 * دوال مساعدة للحلقات: نافذة الدخول، الإجازات، ترقيم الجلسات، تنسيق نص التقرير
 */
import { useEffect, useState } from 'react';
import { normalizeArabic } from './userScopeHelper';
import { getCurriculumData } from './curriculumHelper';

export const JOIN_EARLY_MINUTES = 15;

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const getArabicDayNameFromDate = (d) => DAY_NAMES[d.getDay()];

export const getArabicDayName = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = String(dateString).replace(/\//g, '-').split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
};

/** تاريخ محلي بصيغة YYYY-MM-DD */
export const toLocalDateStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

/** هل التاريخ ضمن إجازة رسمية؟ (holidays: [{from, to, name}]) */
export const getHolidayForDate = (dateStr, holidays = []) => {
  if (!dateStr) return null;
  const ds = String(dateStr).replace(/\//g, '-');
  return (holidays || []).find(h => {
    const from = String(h.from || h.to || '').replace(/\//g, '-');
    const to = String(h.to || h.from || '').replace(/\//g, '-');
    return from && ds >= from && ds <= to;
  }) || null;
};

/**
 * حالة زر الدخول للحلقة:
 * يُفعَّل قبل الموعد بربع ساعة ويتوقف مع انتهاء وقت الحلقة.
 */
export const getJoinState = (session, holidays = [], now = new Date()) => {
  if (!session) return { open: false, reason: 'لا توجد حلقة' };

  const holiday = getHolidayForDate(toLocalDateStr(now), holidays);
  if (holiday) return { open: false, reason: `إجازة${holiday.name ? `: ${holiday.name}` : ''}` };

  const workDays = session.workDays || [];
  const today = normalizeArabic(getArabicDayNameFromDate(now));
  if (workDays.length > 0 && !workDays.some(d => normalizeArabic(d) === today)) {
    return { open: false, reason: 'اليوم ليس من أيام الحلقة' };
  }

  const start = timeToMinutes(session.time_start);
  let end = timeToMinutes(session.time_end);
  if (start === null || end === null) return { open: false, reason: 'لم يتم تحديد موعد الحلقة' };
  if (end <= start) end += 24 * 60;

  const current = now.getHours() * 60 + now.getMinutes();
  if (current < start - JOIN_EARLY_MINUTES) {
    return { open: false, reason: 'يُفتح الدخول قبل الموعد بـ 15 دقيقة' };
  }
  if (current >= end) return { open: false, reason: 'انتهى وقت الحلقة' };
  return { open: true, reason: '' };
};

/** Hook يحدّث الوقت الحالي بشكل دوري لتحديث حالة الأزرار تلقائياً */
export const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
};

/**
 * رقم الجلسة التالي للحلقة: يبدأ من رقم البدء الذي حدده الأدمن (الافتراضي 1)
 * ثم يزيد حسب ترتيب التقارير المسجلة.
 */
export const getNextSessionNumber = (session, sessionReports = [], isPlatform = true) => {
  const start = parseInt(session?.start_session_no, 10);
  const startNo = isNaN(start) || start < 1 ? 1 : start;
  const nums = (sessionReports || [])
    .filter(r => String(r.sessionId) === String(session?.id) && !!r.isPlatform === !!isPlatform)
    .map(r => parseInt(r.sessionNum, 10))
    .filter(n => !isNaN(n));
  if (nums.length === 0) return startNo;
  return Math.max(Math.max(...nums) + 1, startNo);
};

const hasRange = (sec) => !!(sec && sec.fromSurah);

// تنسيق نطاق (تسميع / تصحيح) على نموذج: سورة X / من الايه رقم (a) / الى الايه رقم (b)
const recitationBlock = (sec) => {
  if (!hasRange(sec)) return 'لا يوجد';
  if (!sec.toSurah || sec.toSurah === sec.fromSurah) {
    return `سورة ${sec.fromSurah}\nمن الايه رقم (${sec.fromAyah || '-'})\nالى الايه رقم (${sec.toAyah || '-'})`;
  }
  return `من سورة ${sec.fromSurah} الايه رقم (${sec.fromAyah || '-'})\nالى سورة ${sec.toSurah} الايه رقم (${sec.toAyah || '-'})`;
};

// تنسيق نطاق المراجعة: سورة X(a) / الى الايه (b)
const reviewBlock = (sec) => {
  if (!hasRange(sec)) return 'لا يوجد';
  if (!sec.toSurah || sec.toSurah === sec.fromSurah) {
    return `سورة ${sec.fromSurah}(${sec.fromAyah || '-'})\nالى الايه (${sec.toAyah || '-'})`;
  }
  return `سورة ${sec.fromSurah}(${sec.fromAyah || '-'})\nالى سورة ${sec.toSurah} (${sec.toAyah || '-'})`;
};

const studentWord = (session) => {
  const t = session?.student_type || '';
  if (t.includes('أطفال') || t.includes('اطفال')) return 'الطفل';
  if (t.includes('نساء')) return 'الدارسة';
  return 'الدارس';
};

/** تفريغ تقرير المحفظ إلى نص منسق للدارس (على نموذج الحلقات المعتمد) */
export const formatReportText = (report, session) => {
  if (!report) return '';
  const [y, m, d] = String(report.date || '').replace(/\//g, '-').split('-').map(Number);
  const dateText = y ? `${y}/${m}/${d}م` : '';
  const country = (session?.countries || []).join('، ');
  const num = report.sessionNum || session?.session_no || '';

  const lines = [];
  lines.push(`🌷تقرير حلقة (${num})`);
  if (country) lines.push(`دولة ${country} 🌷`);
  lines.push(`يوم ${getArabicDayName(report.date)}`);
  lines.push(dateText);
  lines.push('');
  lines.push('👈التسميع: ');
  lines.push(recitationBlock(report.review));
  lines.push('');
  lines.push('👈التصحيح: ');
  lines.push(recitationBlock(report.memorization));
  lines.push('');
  lines.push('👈المراجعة القريبة: ');
  lines.push(reviewBlock(report.recentReview));
  lines.push('');
  lines.push('👈المراجعة البعيدة: ');
  lines.push(reviewBlock(report.distantReview));
  lines.push('');
  lines.push('✍️✍️✍️✍️✍️');

  // المطلوب في الحلقة القادمة: التسميع = ما تم تصحيحه اليوم، والمراجعة من الجلسة التالية في المنهج
  const curriculum = getCurriculumData(session?.rowaq, session?.level);
  const nextEntry = curriculum ? curriculum.find(c => c.session === (parseInt(report.sessionNum, 10) || 0) + 1) : null;
  lines.push(`المطلوب من ${studentWord(session)} الحلقة القادمة: `);
  lines.push('✍️التسميع:');
  lines.push(recitationBlock(report.memorization));
  lines.push('');
  lines.push('✍️المراجعة القريبة:');
  lines.push(reviewBlock(nextEntry?.recentReview));
  lines.push('');
  lines.push('✍️المراجعة البعيدة:');
  lines.push(reviewBlock(nextEntry?.distantReview));
  lines.push('🤲دمتم موفقين🤲');
  return lines.join('\n');
};

/** إيجاد سجل الدارس في بيانات الدارسين اعتماداً على المستخدم الحالي */
export const findStudentRecord = (user, platformStudents = []) => {
  if (!user) return null;
  const nid = String(user.national_id || user.username || '').trim();
  const name = normalizeArabic(user.name || '');
  return platformStudents.find(st => {
    const pNo = String(st.passport_no || '').trim();
    const nId = String(st.national_id || '').trim();
    return (pNo && pNo === nid) || (nId && nId === nid) ||
      (name && normalizeArabic(st.name || '') === name);
  }) || null;
};

export const getStudentsOfSession = (session, platformStudents = []) =>
  platformStudents.filter(s => !s.isArchived && (
    (s.session_id && String(s.session_id) === String(session?.id)) ||
    String(s.session_no) === String(session?.session_no)
  ));

