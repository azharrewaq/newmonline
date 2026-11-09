/**
 * placementHelpers.js
 * ثوابت ودوال مساعدة لمنظومة تحديد المستوى للمتقدمين الجدد (40 مجموعة يومياً × 25 دارساً)
 * - 20 مجموعة في الفترة الأولى: من 6 إلى 8 مساءً (18:00 - 20:00)
 * - 20 مجموعة في الفترة الثانية: من 8 إلى 10 مساءً (20:00 - 22:00)
 */
import { normalizeArabic } from './userScopeHelper';
import { toLocalDateStr, getArabicDayName } from './sessionHelpers';
import egyptCenters from '../data/egyptCenters';

export const PLACEMENT_GROUP_CAPACITY = 25;
export const PLACEMENT_TOTAL_GROUPS = 40;

export const APPLICANT_GENDER_OPTIONS = ['ذكر', 'أنثى'];
export const GOVERNORATES_LIST = Object.keys(egyptCenters);

export const normalizeApplicantGender = (gender = '', rowaq = '') => {
  const g = normalizeArabic(gender || '');
  if (g.includes('انث') || g.includes('نسا') || g.includes('سيد')) return 'أنثى';
  if (g.includes('ذكر') || g.includes('رجل') || g.includes('رجال')) return 'ذكر';
  const r = normalizeArabic(rowaq || '');
  if (r.includes('سيدات') || r.includes('نساء')) return 'أنثى';
  if (r.includes('رجال')) return 'ذكر';
  return '';
};

// خيارات الرواق للمتقدمين الجدد (بدون تجويد أو قراءات)
export const APPLICANT_ROWAQ_OPTIONS = [
  'رواق القرآن الكريم ( أطفال )',
  'رواق القرآن الكريم كبار ( رجال )',
  'رواق القرآن الكريم كبار ( سيدات )',
];

// المستويات المرتبطة بنوع الرواق وفق المعمول به في الحلقات الأصلية
export const CHILDREN_LEVELS = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس',
  'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'مستوى الإتقان (تجويد) أطفال',
];

export const SENIORS_LEVELS = [
  'نظام السنة الواحدة',
  'نظام العامين',
  'نظام الثلاث سنوات',
  'نظام الاربع سنوات ( من سورة البقرة )',
  'نظام الاربع سنوات ( من سورة الناس )',
  'نظام الخمس سنوات ( من سورة البقرة )',
  'نظام الخمس سنوات ( من سورة الناس )',
];

export const getLevelsForApplicantRowaq = (rowaq) => {
  const n = normalizeArabic(rowaq || '');
  if (!n) return [];
  if (n.includes('اطفال') || n.includes('طفل')) return CHILDREN_LEVELS;
  if (n.includes('كبار') || n.includes('رجال') || n.includes('نساء')) return SENIORS_LEVELS;
  return [];
};

// تطبيع قيمة الرواق القادمة من ملف إكسيل أو بيانات قديمة إلى أحد الخيارات الثلاثة
export const normalizeApplicantRowaq = (rowaq, gender = '') => {
  const r = normalizeArabic(rowaq || '');
  const g = normalizeArabic(gender || '');
  if (!r) return '';
  if (r.includes('اطفال') || r.includes('طفل')) return 'رواق القرآن الكريم ( أطفال )';
  if (r.includes('سيدات') || r.includes('نساء') || r.includes('اناث') || r.includes('انثي') || g.includes('انثي') || g.includes('نساء') || g.includes('سيدات')) {
    return 'رواق القرآن الكريم كبار ( سيدات )';
  }
  if (r.includes('رجال') || r.includes('ذكور') || r.includes('ذكر') || r.includes('كبار')) {
    return 'رواق القرآن الكريم كبار ( رجال )';
  }
  return rowaq;
};

// تحويل اختيار الرواق في المتقدمين إلى (rowaq + student_type) المعتمد في الحلقات الأصلية
export const mapApplicantRowaqToOriginal = (applicantRowaq) => {
  const norm = normalizeApplicantRowaq(applicantRowaq);
  if (norm === 'رواق القرآن الكريم ( أطفال )') {
    return { rowaq: 'رواق القرآن الكريم ( أطفال )', student_type: 'أطفال', gender: 'أطفال' };
  }
  if (norm === 'رواق القرآن الكريم كبار ( سيدات )') {
    return { rowaq: 'رواق القرآن الكريم ( كبار )', student_type: 'نساء', gender: 'أنثى' };
  }
  return { rowaq: 'رواق القرآن الكريم ( كبار )', student_type: 'رجال', gender: 'ذكر' };
};

// الأيام المناسبة للدارس (كل يومين مرتبطين)
export const PREFERRED_DAYS_OPTIONS = [
  'السبت - الثلاثاء',
  'الأحد - الأربعاء',
  'الاثنين - الخميس',
];

export const normalizePreferredDays = (days) => {
  const n = normalizeArabic(days || '');
  if (!n) return '';
  if (n.includes('سبت') || n.includes('ثلاثاء')) return 'السبت - الثلاثاء';
  if (n.includes('احد') || n.includes('اربعاء')) return 'الأحد - الأربعاء';
  if (n.includes('اثنين') || n.includes('خميس')) return 'الاثنين - الخميس';
  return days;
};

// التوقيت المناسب للدارس للحلقات الأصلية لاحقاً
export const PREFERRED_TIME_OPTIONS = [
  'من 6 إلى 7 مساء',
  'من 7 إلى 8 مساء',
  'من 8 إلى 9 مساء',
  'من 9 إلى 10 مساء',
];

// مواعيد اختبار تحديد المستوى المتاحة (من 6 إلى 8 مساءً مقسمة لـ 4 فترات نصف ساعة)
export const EXAM_TIME_OPTIONS = [
  '18:00 - 18:30',
  '18:30 - 19:00',
  '19:00 - 19:30',
  '19:30 - 20:00',
  '18:00',
  '19:00',
  '20:00',
];

/**
 * توليد الـ 40 مجموعة الافتراضية بدون تحديد توقيت مسبق (يترك التوقيت لإدخال المستخدمين)
 */
export const createDefaultPlacementGroups = () => {
  return Array.from({ length: PLACEMENT_TOTAL_GROUPS }, (_, i) => {
    const groupNo = i + 1;
    return {
      id: `pg-${groupNo}`,
      group_no: groupNo,
      title: `مجموعة ${groupNo}`,
      shift_label: 'من 05:30 م إلى 09:00 م',
      time_start: '17:30',
      time_end: '21:00',
      capacity: PLACEMENT_GROUP_CAPACITY,
      scientific_supervisor: '',
      technical_supervisor: '',
      mohfez: '',
      coordinator: '',
      teams_link: '',
    };
  });
};

/**
 * فحص ما إذا كانت بيانات توقيت المجموعة هي القيم الافتراضية القديمة
 */
export const isLegacyDefaultGroupShift = () => false;

/**
 * تحويل الأرقام العربية (٠-٩) والفارسية إلى أرقام غربية (0-9)
 */
const toWesternDigits = (str) =>
  String(str ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

/**
 * توحيد صيغة تاريخ الاختبار إلى YYYY-MM-DD
 * يدعم:
 * - أرقام التاريخ التسلسلية من Excel (مثل 46335 -> 2026-11-09)
 * - صيغة YYYY-MM-DD أو YYYY/MM/DD
 * - صيغة DD-MM-YYYY أو DD/MM/YYYY
 */
export const normalizeExamDate = (val) => {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = toWesternDigits(val).trim();
  if (!s) return '';

  // 1. رقم تسلسلي من Excel (مثل 46335 أو 46335.0)
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial >= 20000 && serial <= 90000) {
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }

  // 2. صيغة YYYY-M-D أو YYYY/M/D
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = String(ymd[2]).padStart(2, '0');
    const d = String(ymd[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. صيغة D-M-YYYY أو D/M/YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const n1 = parseInt(dmy[1], 10);
    const n2 = parseInt(dmy[2], 10);
    const y = dmy[3];
    // في النظام العربي اليوم أولاً (DD/MM/YYYY)، إلا إذا كان الرقم الثاني أكبر من 12
    const day = n2 > 12 && n1 <= 12 ? n2 : n1;
    const month = n2 > 12 && n1 <= 12 ? n1 : n2;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return s.replace(/\//g, '-');
};

/**
 * تنسيق تاريخ الاختبار للعرض باللغة العربية مع اسم اليوم (مثل: الاثنين 2026-11-09)
 */
export const formatExamDateAr = (val) => {
  const norm = normalizeExamDate(val);
  if (!norm) return '';
  const dayName = getArabicDayName(norm);
  return dayName ? `${dayName} ${norm}` : norm;
};

/**
 * ترحيل مواعيد دارسي يوم 9 نوفمبر لما بعد اليوم الأخير لكل مجموعة
 */
export const rescheduleApplicantDay9 = (applicant) => {
  if (!applicant) return applicant;
  const d = normalizeExamDate(applicant.exam_date);
  if (d !== '2026-11-09' && d !== '46335') {
    return applicant;
  }
  const g = Number(applicant.group_no);
  let newDate = '2026-11-14';
  if ((g >= 1 && g <= 2) || (g >= 31 && g <= 40)) {
    newDate = '2026-11-14';
  } else if ((g >= 3 && g <= 5) || (g >= 11 && g <= 20)) {
    newDate = '2026-11-13';
  } else if ((g >= 6 && g <= 10) || (g >= 21 && g <= 22)) {
    newDate = '2026-11-15';
  }
  return { ...applicant, exam_date: newDate };
};

/**
 * تقسيم مواعيد المتقدمين في كل مجموعة (ساعتين) إلى 4 مواعيد (نصف ساعة لكل ربع دارسين)
 * - المجموعات 1 إلى 20: من 18:00 إلى 20:00 (18:00-18:30, 18:30-19:00, 19:00-19:30, 19:30-20:00)
 * - المجموعات 21 إلى 40: من 20:00 إلى 22:00 (20:00-20:30, 20:30-21:00, 21:00-21:30, 21:30-22:00)
 */
export const splitApplicantsIntoQuarterTimes = (applicants = []) => {
  if (!Array.isArray(applicants) || applicants.length === 0) return applicants;

  const validSlots = ['18:00 - 18:30', '18:30 - 19:00', '19:00 - 19:30', '19:30 - 20:00'];

  // إذا كان جميع المتقدمين لديهم بالفعل توقيت مقسم ومعتمد، لا حاجة لإعادة التوزيع
  const needsSplit = applicants.some(a => {
    const tm = normalizeExamTime(a?.exam_time);
    return !tm || !validSlots.includes(tm);
  });
  if (!needsSplit) {
    return applicants;
  }

  const groupDateMap = new Map();
  applicants.forEach((app, idx) => {
    const gNo = Number(app?.group_no);
    if (!gNo || isNaN(gNo) || gNo < 1 || gNo > 40) return;
    const d = normalizeExamDate(app?.exam_date) || 'بدون_تاريخ';
    const key = `${gNo}||${d}`;
    if (!groupDateMap.has(key)) groupDateMap.set(key, []);
    groupDateMap.get(key).push(idx);
  });

  const updated = [...applicants];

  groupDateMap.forEach((indices) => {
    // ترتيب ثابت لضمان عدم تغير التوزيع عند اختلاف ترتيب العناصر
    indices.sort((i1, i2) => {
      const a = applicants[i1];
      const b = applicants[i2];
      const aNid = String(a?.national_id || a?.passport_no || a?.id || a?.name || '');
      const bNid = String(b?.national_id || b?.passport_no || b?.id || b?.name || '');
      return aNid.localeCompare(bNid);
    });

    const N = indices.length;
    const q = Math.floor(N / 4);
    const rem = N % 4;
    const slotCounts = [
      q + (rem > 0 ? 1 : 0),
      q + (rem > 1 ? 1 : 0),
      q + (rem > 2 ? 1 : 0),
      q,
    ];

    let cur = 0;
    for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
      const count = slotCounts[slotIdx];
      const slotTime = validSlots[slotIdx];
      for (let i = 0; i < count; i++) {
        if (cur >= N) break;
        const appIdx = indices[cur];
        // إذا كان المتقدم يمتلك بالفعل توقيتاً معتمداً نحافظ عليه، وإلا نسند إليه الفترة
        const existingTm = normalizeExamTime(updated[appIdx]?.exam_time);
        if (!validSlots.includes(existingTm)) {
          updated[appIdx] = {
            ...updated[appIdx],
            exam_time: slotTime,
          };
        }
        cur++;
      }
    }
  });

  return updated;
};

/**
 * توحيد صيغة توقيت الاختبار إلى HH:MM (يدعم كسور الوقت العشرية من Excel مثل 0.75 -> 18:00)
 */
export const normalizeExamTime = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const s = toWesternDigits(val).trim();
  if (!s) return '';

  // كسر عشري من Excel (مثل 0.75 = 18:00 أو 46335.75)
  if (/^\d*\.\d+$/.test(s)) {
    const num = Number(s);
    const frac = num >= 1 ? num - Math.floor(num) : num;
    if (frac > 0 && frac < 1) {
      const totalMins = Math.round(frac * 24 * 60);
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return s.replace('.', ':');
};

const parseMinutes = (timeStr) => {
  if (!timeStr) return null;
  const clean = normalizeExamTime(timeStr);
  const m = clean.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return null;
  // إذا أُدخلت الساعة كـ 6 أو 7 أو 8 أو 9 أو 10 بدون نظام 24 ساعة في الفترة المسائية
  if (h >= 1 && h <= 11 && !clean.toLowerCase().includes('am') && !clean.includes('ص')) {
    h += 12;
  }
  return h * 60 + min;
};

/**
 * فحص ظهور رابط اختبار تحديد المستوى للدارس المتقدم:
 * - يختفي الرابط تماماً في غير يوم الاختبار الخاص بالدارس
 * - في يوم الاختبار: يظهر قبل توقيت الاختبار بـ 15 دقيقة ويختفي بعده بـ 15 دقيقة
 */
export const getApplicantExamJoinState = (applicant, group = null, now = new Date()) => {
  if (!applicant) return { visible: false, open: false, reason: 'لا توجد بيانات متقدم' };

  const examDate = normalizeExamDate(applicant.exam_date);
  if (!examDate) {
    return { visible: false, open: false, reason: 'لم يتم تحديد يوم الاختبار بعد' };
  }

  const today = toLocalDateStr(now);
  if (examDate !== today) {
    const formattedDate = formatExamDateAr(examDate) || examDate;
    if (examDate > today) {
      return { visible: false, open: false, reason: `موعد اختبارك يوم ${formattedDate} (يظهر ويتفعل الرابط في يوم الاختبار من 05:30 مساءً إلى 09:00 مساءً)` };
    }
    return { visible: false, open: false, reason: 'انتهى يوم الاختبار الخاص بك' };
  }

  // توقيت عمل المجموعة: من 5:30 مساءً (17:30) إلى 9:00 مساءً (21:00)
  const groupStart = parseMinutes(group?.time_start || '17:30') ?? (17 * 60 + 30);
  const groupEnd = parseMinutes(group?.time_end || '21:00') ?? (21 * 60);

  const rangeMatch = (normalizeExamTime(applicant.exam_time) || '').match(/^(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})$/);
  const applicantStart = rangeMatch ? parseMinutes(rangeMatch[1]) : parseMinutes(applicant.exam_time);
  const applicantEnd = rangeMatch ? parseMinutes(rangeMatch[2]) : (applicantStart !== null ? applicantStart + 30 : null);

  // فترة تفعيل الرابط: خلال فترة المجموعة (من 5:30 م إلى 9:00 م) مع سماحية 15 دقيقة قبل وبعد
  const effectiveStart = Math.min(groupStart, applicantStart !== null ? applicantStart : groupStart);
  const effectiveEnd = Math.max(groupEnd, applicantEnd !== null ? applicantEnd : groupEnd);

  const openFrom = effectiveStart - 15; // سماحية 15 دقيقة قبل بداية المجموعة (05:15 م)
  const closeAt = effectiveEnd + 15;     // سماحية 15 دقيقة بعد نهاية المجموعة (09:15 م)

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (currentMinutes < openFrom) {
    const startStr = group?.time_start ? formatTime12Ar(group.time_start) : '05:30 م';
    const endStr = group?.time_end ? formatTime12Ar(group.time_end) : '09:00 م';
    return {
      visible: false,
      open: false,
      reason: `يظهر ويتفعل رابط الاختبار اليوم في موعد عمل المجموعة (من ${startStr} إلى ${endStr})`,
    };
  }
  if (currentMinutes > closeAt) {
    return {
      visible: false,
      open: false,
      reason: 'انتهى الوقت المخصص لاختبار تحديد المستوى لليوم (كان متاحاً حتى 09:00 مساءً)',
    };
  }

  return { visible: true, open: true, reason: '' };
};

export const formatTime12Ar = (timeStr) => {
  if (!timeStr) return '-';
  const clean = normalizeExamTime(timeStr);
  const rangeMatch = clean.match(/^(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})$/);
  if (rangeMatch) {
    const formatSingle = (str) => {
      const mins = parseMinutes(str);
      if (mins === null) return str;
      let h = Math.floor(mins / 60);
      const m = String(mins % 60).padStart(2, '0');
      const period = h >= 12 ? 'م' : 'ص';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${m} ${period}`;
    };
    return `من ${formatSingle(rangeMatch[1])} إلى ${formatSingle(rangeMatch[2])}`;
  }

  const mins = parseMinutes(clean);
  if (mins === null) return timeStr || '-';
  let h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
};

/**
 * استخراج وصف توقيت المجموعة (افتراضياً من 05:30 م إلى 09:00 م)
 */
export const getGroupTimeLabel = (group, groupApplicants = []) => {
  if (group) {
    const start = normalizeExamTime(group.time_start) || '17:30';
    const end = normalizeExamTime(group.time_end) || '21:00';
    if (start && end) return `من ${formatTime12Ar(start)} إلى ${formatTime12Ar(end)}`;
    if (start) return formatTime12Ar(start);
    if (group.shift_label) return group.shift_label;
  }
  const appTime = normalizeExamTime(groupApplicants?.[0]?.exam_time);
  if (appTime) return formatTime12Ar(appTime);
  return 'من 05:30 م إلى 09:00 م';
};

const escapeHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * تجهيز كشوف الطباعة مقسمة لكل مجموعة ومنسق
 * @param {Array} applicants قائمة المتقدمين المفلترة
 * @param {Array} placementGroups قائمة الـ 40 مجموعة
 * @param {Object} options { targetGroupNo, targetCoordinator, targetDate, padToCapacity }
 */
export const buildExamSheetsByGroupAndCoordinator = (
  applicants = [],
  placementGroups = [],
  options = {}
) => {
  // ترحيل أي دارس ما زال يحمل تاريخ 9 تلقائياً وتقسيم المواعيد لـ 4 فترات نصف ساعة
  const effectiveApplicants = splitApplicantsIntoQuarterTimes(
    (applicants || []).map(rescheduleApplicantDay9)
  );
  const {
    targetGroupNo = '',
    targetCoordinator = '',
    targetDate = '',
    padToCapacity = false,
    splitByDate = false,
    examStage = 'ALL',
    blankResults = false,
  } = options;

  const normTargetDate = targetDate && targetDate !== 'ALL' && targetDate !== 'SPLIT_BY_DATE'
    ? normalizeExamDate(targetDate)
    : '';
  const shouldSplitByDate = splitByDate || targetDate === 'SPLIT_BY_DATE';

  // إذا طُلب طباعة مجموعة محددة حتى لو كانت فارغة من الدارسين حالياً
  if (targetGroupNo) {
    const grp = placementGroups.find(g => String(g.group_no) === String(targetGroupNo));
    let groupApplicants = effectiveApplicants.filter(a => String(a.group_no || '') === String(targetGroupNo));
    if (normTargetDate) {
      groupApplicants = groupApplicants.filter(a => normalizeExamDate(a.exam_date) === normTargetDate);
    }

    // إذا طلب تقسيم المجموعة كاملة إلى كشف مستقل لكل يوم اختبار
    if (shouldSplitByDate && groupApplicants.length > 0) {
      const byDate = new Map();
      groupApplicants.forEach(a => {
        const d = normalizeExamDate(a.exam_date) || 'بدون تاريخ';
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d).push(a);
      });
      return Array.from(byDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([d, rows]) => ({
          groupNo: grp?.group_no || targetGroupNo,
          shiftLabel: getGroupTimeLabel(grp, rows),
          scientificSupervisor: grp?.scientific_supervisor || rows[0]?.scientific_supervisor || '',
          technicalSupervisor: grp?.technical_supervisor || rows[0]?.technical_supervisor || '',
          coordinator: targetCoordinator || grp?.coordinator || rows[0]?.coordinator || '',
          mohfez: grp?.mohfez || rows[0]?.mohfez || '',
          examDate: d === 'بدون تاريخ' ? '' : d,
          rows,
          padCount: padToCapacity ? Math.max(rows.length, PLACEMENT_GROUP_CAPACITY) : Math.max(rows.length, 1),
          examStage,
          blankResults,
        }));
    }

    const uniqueDates = Array.from(
      new Set(groupApplicants.map(a => normalizeExamDate(a.exam_date)).filter(Boolean))
    ).sort();
    const resolvedExamDate = normTargetDate
      || (uniqueDates.length === 1 ? uniqueDates[0] : (uniqueDates.length > 1 ? `المجموعة كاملة (${uniqueDates.join(' ، ')})` : ''));

    return [{
      groupNo: grp?.group_no || targetGroupNo,
      shiftLabel: getGroupTimeLabel(grp, groupApplicants),
      scientificSupervisor: grp?.scientific_supervisor || groupApplicants[0]?.scientific_supervisor || '',
      technicalSupervisor: grp?.technical_supervisor || groupApplicants[0]?.technical_supervisor || '',
      coordinator: targetCoordinator || grp?.coordinator || groupApplicants[0]?.coordinator || '',
      mohfez: grp?.mohfez || groupApplicants[0]?.mohfez || '',
      examDate: resolvedExamDate,
      rows: groupApplicants,
      padCount: groupApplicants.length === 0 || padToCapacity
        ? Math.max(groupApplicants.length, PLACEMENT_GROUP_CAPACITY)
        : groupApplicants.length,
      examStage,
      blankResults,
    }];
  }

  // تصفية حسب اليوم المحدد في حال اختيار كل المجموعات ليوم معين
  const sourceApplicants = normTargetDate
    ? effectiveApplicants.filter(a => normalizeExamDate(a.exam_date) === normTargetDate)
    : effectiveApplicants;

  // إذا كان هناك دارسون، نقسمهم إلى كشف مستقل لكل (مجموعة + منسق) أو (+ يوم)
  if (sourceApplicants.length > 0) {
    const map = new Map();
    sourceApplicants.forEach(a => {
      const gNo = a.group_no ? String(a.group_no) : 'غير مسكن';
      const grp = placementGroups.find(g => String(g.group_no) === gNo);
      const sciSup = (a.scientific_supervisor || grp?.scientific_supervisor || '').trim();
      const techSup = (a.technical_supervisor || grp?.technical_supervisor || '').trim();
      const coord = (a.coordinator || grp?.coordinator || targetCoordinator || '').trim();
      const mohfez = (a.mohfez || grp?.mohfez || '').trim();
      const examDate = normalizeExamDate(a.exam_date || normTargetDate || '');
      const key = shouldSplitByDate ? `${gNo}||${coord}||${examDate}` : `${gNo}||${coord}`;
      if (!map.has(key)) {
        map.set(key, {
          groupNo: gNo,
          shiftLabel: getGroupTimeLabel(grp, [a]),
          scientificSupervisor: sciSup,
          technicalSupervisor: techSup,
          coordinator: coord,
          mohfez,
          examDate,
          datesSet: new Set(examDate ? [examDate] : []),
          rows: [],
        });
      }
      const bucket = map.get(key);
      if (!bucket.scientificSupervisor && sciSup) bucket.scientificSupervisor = sciSup;
      if (!bucket.technicalSupervisor && techSup) bucket.technicalSupervisor = techSup;
      if (!bucket.mohfez && mohfez) bucket.mohfez = mohfez;
      if (!bucket.shiftLabel) bucket.shiftLabel = getGroupTimeLabel(grp, [a]);
      if (examDate) bucket.datesSet.add(examDate);
      if (!bucket.examDate && examDate) bucket.examDate = examDate;
      bucket.rows.push(a);
    });

    const sheets = Array.from(map.values()).sort((a, b) => {
      const na = parseInt(a.groupNo, 10) || 999;
      const nb = parseInt(b.groupNo, 10) || 999;
      if (na !== nb) return na - nb;
      return (a.examDate || '').localeCompare(b.examDate || '');
    });
    return sheets.map(s => {
      const datesArr = Array.from(s.datesSet || []).sort();
      const examDateLabel = normTargetDate
        || (shouldSplitByDate ? s.examDate : (datesArr.length === 1 ? datesArr[0] : (datesArr.length > 1 ? `المجموعة كاملة (${datesArr.join(' ، ')})` : s.examDate)));
      return {
        ...s,
        examDate: examDateLabel,
        padCount: padToCapacity ? Math.max(s.rows.length, PLACEMENT_GROUP_CAPACITY) : Math.max(s.rows.length, 1),
        examStage,
        blankResults,
      };
    });
  }

  // إذا لم يكن هناك دارسون بعد، نطبع نموذجاً فارغاً (25 صفاً) للمجموعات المطابقة
  const groupsToPrint = targetCoordinator
    ? placementGroups.filter(g => normalizeArabic(g.coordinator || '') === normalizeArabic(targetCoordinator))
    : [placementGroups[0] || { group_no: 1, shift_label: '', coordinator: '', mohfez: '' }];

  return (groupsToPrint.length > 0 ? groupsToPrint : [placementGroups[0]]).map(grp => ({
    groupNo: grp?.group_no || 1,
    shiftLabel: getGroupTimeLabel(grp, []),
    scientificSupervisor: grp?.scientific_supervisor || '',
    technicalSupervisor: grp?.technical_supervisor || '',
    coordinator: grp?.coordinator || targetCoordinator || '',
    mohfez: grp?.mohfez || '',
    examDate: targetDate || '',
    rows: [],
    padCount: PLACEMENT_GROUP_CAPACITY,
    examStage,
    blankResults,
  }));
};

/**
 * فتح نافذة طباعة كشوف اختبار تحديد المستوى بالديباجة الرسمية للجامع الأزهر
 */
export const printPlacementExamSheets = (sheets = []) => {
  if (!sheets || sheets.length === 0) {
    alert('لا توجد كشوف للطباعة');
    return;
  }

  const pagesHtml = sheets.map((sheet) => {
    const isBefore = sheet.examStage === 'BEFORE' || sheet.blankResults;
    const isAfter = sheet.examStage === 'AFTER';
    const totalRows = Math.max(sheet.rows?.length || 0, sheet.padCount || PLACEMENT_GROUP_CAPACITY);
    let trs = '';
    for (let i = 0; i < totalRows; i++) {
      const a = sheet.rows?.[i] || {};
      const rowaq = normalizeApplicantRowaq(a.rowaq, a.gender) || '';
      const appliedLevel = a.applied_level || a.level || '';
      const testedLevel = isBefore ? '' : (a.tested_level || '');
      const stoppedSurah = isBefore ? '' : (a.stopped_surah || '');
      const prefDays = normalizePreferredDays(a.preferred_days) || '';
      const prefTime = a.preferred_time || '';
      const q1Val = isBefore ? '' : (a.q1 ?? '');
      const q2Val = isBefore ? '' : (a.q2 ?? '');
      const q3Val = isBefore ? '' : (a.q3 ?? '');
      const q4Val = isBefore ? '' : (a.q4 ?? '');
      const q5Val = isBefore ? '' : (a.q5 ?? '');
      trs += `
        <tr>
          <td class="col-idx">${i + 1}</td>
          <td class="col-name">${escapeHtml(a.name || '')}</td>
          <td class="col-nid" dir="ltr">${escapeHtml(a.national_id || a.passport_no || '')}</td>
          <td class="col-q">${escapeHtml(q1Val)}</td>
          <td class="col-q">${escapeHtml(q2Val)}</td>
          <td class="col-q">${escapeHtml(q3Val)}</td>
          <td class="col-q">${escapeHtml(q4Val)}</td>
          <td class="col-q">${escapeHtml(q5Val)}</td>
          <td class="col-q col-total"></td>
          <td class="col-rowaq">${escapeHtml(rowaq)}</td>
          <td class="col-level">${escapeHtml(testedLevel)}</td>
          <td class="col-surah">${escapeHtml(stoppedSurah)}</td>
          <td class="col-days">${escapeHtml(prefDays)}</td>
          <td class="col-pref-time">${escapeHtml(prefTime)}</td>
          <td class="col-exam-time">${escapeHtml(a.exam_time ? formatTime12Ar(a.exam_time) : '')}</td>
        </tr>
      `;
    }

    const groupDisplay = sheet.groupNo && sheet.groupNo !== 'غير مسكن'
      ? `مجموعة (${escapeHtml(sheet.groupNo)})${sheet.shiftLabel ? ` — ${escapeHtml(sheet.shiftLabel)}` : ''}`
      : '................................';

    let sheetTitle = 'كشف تحديد مستوى المنصة المحلية بالجامع الأزهر نوفمبر 2026';
    if (isBefore) {
      sheetTitle = 'كشف لجنة اختبار تحديد المستوى — نموذج الرصد (قبل الاختبار)';
    } else if (isAfter) {
      sheetTitle = 'كشف نتائج تحديد المستوى والرصد النهائي (بعد الاختبار)';
    }

    return `
      <section class="print-sheet">
        <header class="sheet-header">
          <div class="header-right">
            <div class="org-main">الجامع الأزهر</div>
            <div class="org-sub">إدارة شئون الأروقة</div>
          </div>
          <div class="header-center">
            <h1>${sheetTitle}</h1>
          </div>
          <div class="header-left">
            <div>التاريخ: ${escapeHtml(sheet.examDate || '    / 11 / 2026')}</div>
          </div>
        </header>

        <div class="meta-bar">
          <div class="meta-item"><strong>المجموعة:</strong> <span>${groupDisplay}</span></div>
          <div class="meta-item"><strong>المشرف العلمي:</strong> <span>${escapeHtml(sheet.scientificSupervisor || '........................')}</span></div>
          <div class="meta-item"><strong>المشرف التقني:</strong> <span>${escapeHtml(sheet.technicalSupervisor || '........................')}</span></div>
          <div class="meta-item"><strong>المنسق:</strong> <span>${escapeHtml(sheet.coordinator || '........................')}</span></div>
          <div class="meta-item"><strong>المحفظ الممتحن:</strong> <span>${escapeHtml(sheet.mohfez || '........................')}</span></div>
          <div class="meta-item"><strong>عدد الدارسين:</strong> <span>${sheet.rows?.length || PLACEMENT_GROUP_CAPACITY}</span></div>
        </div>

        <table class="exam-table">
          <thead>
            <tr>
              <th style="width: 24px;">م</th>
              <th style="width: 13%;">الاسم</th>
              <th style="width: 9%;">الرقم القومى</th>
              <th style="width: 4.5%;">درجة السؤال الأول</th>
              <th style="width: 4.5%;">درجة السؤال الثانى</th>
              <th style="width: 4.5%;">درجة السؤال الثالث</th>
              <th style="width: 4.5%;">درجة السؤال الرابع</th>
              <th style="width: 4.5%;">درجة السؤال الخامس</th>
              <th style="width: 4.5%;">المجموع</th>
              <th style="width: 11%;">الرواق</th>
              <th style="width: 11%;">المستوى وفق الاختبار</th>
              <th style="width: 9%;">السورة المتوقف عندها</th>
              <th style="width: 6.5%;">الأيام المناسبة</th>
              <th style="width: 6.5%;">الساعة المناسبة</th>
              <th style="width: 7.5%;">وقت الاختبار</th>
            </tr>
          </thead>
          <tbody>
            ${trs}
          </tbody>
        </table>

        <footer class="sheet-footer">
          <div>توقيع المحفظ الممتحن: ........................................</div>
          <div>توقيع المنسق: ........................................</div>
          <div>يعتمد، إدارة شئون الأروقة: ........................................</div>
        </footer>
      </section>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>كشف تحديد مستوى المنصة المحلية بالجامع الأزهر نوفمبر 2026</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', 'Tajawal', 'Traditional Arabic', 'Arial', sans-serif;
      color: #000;
      background: #fff;
      direction: rtl;
    }
    .no-print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #fff;
      padding: 10px 20px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .no-print-bar button {
      background: #d4af37;
      color: #000;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
    }
    .print-sheet {
      padding: 6px 10px;
    }
    .print-sheet + .print-sheet {
      page-break-before: always;
      break-before: page;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .header-right .org-main {
      font-size: 18px;
      font-weight: 800;
    }
    .header-right .org-sub {
      font-size: 15px;
      font-weight: 700;
      margin-top: 2px;
    }
    .header-center {
      text-align: center;
      flex: 1;
      padding: 0 12px;
    }
    .header-center h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      border: 1.5px solid #000;
      display: inline-block;
      padding: 5px 18px;
      border-radius: 6px;
      background: #f8fafc;
    }
    .header-left {
      font-size: 13px;
      font-weight: 700;
      min-width: 150px;
      text-align: left;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      border: 1px solid #000;
      background: #f1f5f9;
      padding: 6px 12px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .exam-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .exam-table th,
    .exam-table td {
      border: 1px solid #000;
      padding: 4px 5px;
      text-align: center;
      vertical-align: middle;
    }
    .exam-table th {
      background: #e2e8f0;
      font-weight: 800;
      font-size: 11.5px;
      line-height: 1.3;
    }
    .exam-table td {
      height: 23px;
    }
    .exam-table td.col-name {
      text-align: right;
      padding-right: 8px;
      font-weight: 600;
    }
    .exam-table td.col-nid {
      font-family: monospace, sans-serif;
      font-size: 12px;
    }
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      font-size: 13px;
      font-weight: 700;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      .print-sheet {
        padding: 0;
      }
    }
  </style>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</head>
<body>
  <div class="no-print-bar">
    <div>معاينة الطباعة — عدد الكشوف: (${sheets.length}) كشف | الجامع الأزهر - إدارة شئون الأروقة</div>
    <button onclick="window.print()">طباعة الكشوف الآن (Print)</button>
  </div>
  ${pagesHtml}
</body>
</html>`;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('يرجى السماح بالنوافذ المنبثقة (Pop-ups) لطباعة الكشف.');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
};

