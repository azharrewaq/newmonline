/**
 * placementHelpers.js
 * ثوابت ودوال مساعدة لمنظومة تحديد المستوى للمتقدمين الجدد (40 مجموعة يومياً × 25 دارساً)
 * - 20 مجموعة في الفترة الأولى: من 6 إلى 8 مساءً (18:00 - 20:00)
 * - 20 مجموعة في الفترة الثانية: من 8 إلى 10 مساءً (20:00 - 22:00)
 */
import { normalizeArabic } from './userScopeHelper';
import { toLocalDateStr } from './sessionHelpers';

export const PLACEMENT_GROUP_CAPACITY = 25;
export const PLACEMENT_TOTAL_GROUPS = 40;

// خيارات الرواق للمتقدمين الجدد (بدون تجويد أو قراءات)
export const APPLICANT_ROWAQ_OPTIONS = [
  'أطفال',
  'كبار رجال',
  'كبار نساء',
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
  if (r.includes('اطفال') || r.includes('طفل')) return 'أطفال';
  if (r.includes('نساء') || r.includes('اناث') || r.includes('انثي') || g.includes('انثي') || g.includes('نساء')) {
    return 'كبار نساء';
  }
  if (r.includes('رجال') || r.includes('ذكور') || r.includes('ذكر') || r.includes('كبار')) {
    return 'كبار رجال';
  }
  return rowaq;
};

// تحويل اختيار الرواق في المتقدمين إلى (rowaq + student_type) المعتمد في الحلقات الأصلية
export const mapApplicantRowaqToOriginal = (applicantRowaq) => {
  const norm = normalizeApplicantRowaq(applicantRowaq);
  if (norm === 'أطفال') {
    return { rowaq: 'رواق القرآن الكريم ( أطفال )', student_type: 'أطفال', gender: 'أطفال' };
  }
  if (norm === 'كبار نساء') {
    return { rowaq: 'رواق القرآن الكريم ( كبار )', student_type: 'نساء', gender: 'أنثى' };
  }
  return { rowaq: 'رواق القرآن الكريم ( كبار )', student_type: 'رجال', gender: 'ذكر' };
};

// الأيام المناسبة للدارس (كل يومين مرتبطين)
export const PREFERRED_DAYS_OPTIONS = [
  'سبت وثلاثاء',
  'أحد وأربعاء',
  'اثنين وخميس',
];

// التوقيت المناسب للدارس للحلقات الأصلية لاحقاً
export const PREFERRED_TIME_OPTIONS = [
  'من 6 إلى 7 مساء',
  'من 7 إلى 8 مساء',
  'من 8 إلى 9 مساء',
  'من 9 إلى 10 مساء',
];

// الفترتان اليوميتان للـ 40 مجموعة اختبار
export const PLACEMENT_SLOTS = [
  { id: 'slot_6_8', label: 'من 6 إلى 8 مساءً', time_start: '18:00', time_end: '20:00', defaultExamTime: '18:00', range: [1, 20] },
  { id: 'slot_8_10', label: 'من 8 إلى 10 مساءً', time_start: '20:00', time_end: '22:00', defaultExamTime: '20:00', range: [21, 40] },
];

/**
 * توليد الـ 40 مجموعة الافتراضية:
 * - المجموعات 1..20: من 6 إلى 8 مساءً
 * - المجموعات 21..40: من 8 إلى 10 مساءً
 * مع ترك تسكين المحفظين والمنسقين والدارسين لاحقاً
 */
export const createDefaultPlacementGroups = () => {
  return Array.from({ length: PLACEMENT_TOTAL_GROUPS }, (_, i) => {
    const groupNo = i + 1;
    const isFirstShift = groupNo <= 20;
    return {
      id: `pg-${groupNo}`,
      group_no: groupNo,
      title: `مجموعة ${groupNo}`,
      shift_label: isFirstShift ? 'من 6 إلى 8 مساءً' : 'من 8 إلى 10 مساءً',
      time_start: isFirstShift ? '18:00' : '20:00',
      time_end: isFirstShift ? '20:00' : '22:00',
      capacity: PLACEMENT_GROUP_CAPACITY,
      mohfez: '',
      coordinator: '',
      teams_link: '',
    };
  });
};

const parseMinutes = (timeStr) => {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  const m = clean.match(/^(\d{1,2}):(\d{2})/);
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
 * - في يوم الاختبار: يظهر قبل توقيت الاختبار بـ 15 دقيقة ويختفي بعده بـ 30 دقيقة
 */
export const getApplicantExamJoinState = (applicant, group = null, now = new Date()) => {
  if (!applicant) return { visible: false, open: false, reason: 'لا توجد بيانات متقدم' };

  const examDate = String(applicant.exam_date || '').replace(/\//g, '-').trim();
  if (!examDate) {
    return { visible: false, open: false, reason: 'لم يتم تحديد يوم الاختبار بعد' };
  }

  const today = toLocalDateStr(now);
  if (examDate !== today) {
    if (examDate > today) {
      return { visible: false, open: false, reason: `موعد اختبارك يوم ${examDate} (يظهر الرابط في يوم الاختبار قبل الموعد بـ 15 دقيقة)` };
    }
    return { visible: false, open: false, reason: 'انتهى يوم الاختبار الخاص بك' };
  }

  const examTimeStr = applicant.exam_time || group?.time_start || '18:00';
  const examMinutes = parseMinutes(examTimeStr);
  if (examMinutes === null) {
    return { visible: true, open: true, reason: '' };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openFrom = examMinutes - 15; // قبل الموعد بربع ساعة
  const closeAt = examMinutes + 30;  // بعد الموعد بنصف ساعة

  if (currentMinutes < openFrom) {
    return {
      visible: false,
      open: false,
      reason: `يظهر ويتفعل رابط الاختبار اليوم قبل الموعد (${formatTime12Ar(examTimeStr)}) بربع ساعة`,
    };
  }
  if (currentMinutes > closeAt) {
    return {
      visible: false,
      open: false,
      reason: 'انتهى الوقت المخصص لدخول اختبار تحديد المستوى',
    };
  }

  return { visible: true, open: true, reason: '' };
};

export const formatTime12Ar = (timeStr) => {
  const mins = parseMinutes(timeStr);
  if (mins === null) return timeStr || '-';
  let h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
};
