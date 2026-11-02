// مناهج الحلقات (مستخرجة لتُستخدم في الصفحات ونص تقرير الدارس)
import { children1Curriculum } from '../data/children1';
import { children2Curriculum } from '../data/children2';
import { children3Curriculum } from '../data/children3';
import { children4Curriculum } from '../data/children4';
import { children5Curriculum } from '../data/children5';
import { children6Curriculum } from '../data/children6';
import { children7Curriculum } from '../data/children7';
import { children8Curriculum } from '../data/children8';
import { children9Curriculum } from '../data/children9';
import { children10Curriculum } from '../data/children10';

import { seniorsOneYearCurriculum } from '../data/seniors_one_year';
import { seniorsTwoYearsCurriculum } from '../data/seniors_two_years';
import { seniorsThreeYearsCurriculum } from '../data/seniors_three_years';
import { seniorsFourYearsFatihahCurriculum } from '../data/seniors_four_years_fatihah';
import { seniorsFourYearsNasCurriculum } from '../data/seniors_four_years_nas';
import { seniorsFiveYearsFatihahCurriculum } from '../data/seniors_five_years_fatihah';
import { seniorsFiveYearsNasCurriculum } from '../data/seniors_five_years_nas';

// Normalize Arabic text: remove hamza variants so الاول === الأول
export const normalizeArabicSimple = (str) => (str || '').trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

export const getCurriculumData = (rowaq, level) => {
  if (!rowaq || !level) return null;
  const lvl = normalizeArabicSimple(level);
  
  if (rowaq.includes('اطفال') || rowaq.includes('أطفال')) {
    if (lvl === 'الاول') return children1Curriculum;
    if (lvl === 'الثاني') return children2Curriculum;
    if (lvl === 'الثالث') return children3Curriculum;
    if (lvl === 'الرابع') return children4Curriculum;
    if (lvl === 'الخامس') return children5Curriculum;
    if (lvl === 'السادس') return children6Curriculum;
    if (lvl === 'السابع') return children7Curriculum;
    if (lvl === 'الثامن') return children8Curriculum;
    if (lvl === 'التاسع') return children9Curriculum;
    if (lvl === 'العاشر') return children10Curriculum;
  } else if (rowaq.includes('كبار')) {
    // نظام السنة الواحدة
    if (lvl === normalizeArabicSimple('نظام السنة الواحدة') || lvl === normalizeArabicSimple('السنة الواحدة')) return seniorsOneYearCurriculum;
    // نظام العامين
    if (lvl === normalizeArabicSimple('نظام العامين') || lvl === normalizeArabicSimple('عامين')) return seniorsTwoYearsCurriculum;
    // نظام الثلاث سنوات
    if (lvl === normalizeArabicSimple('نظام الثلاث سنوات') || lvl === 'ثلاث سنوات') return seniorsThreeYearsCurriculum;
    // نظام الاربع سنوات من البقرة
    if (lvl === normalizeArabicSimple('نظام الاربع سنوات ( من سورة البقرة )') || lvl === normalizeArabicSimple('أربع سنوات من البقرة')) return seniorsFourYearsFatihahCurriculum;
    // نظام الاربع سنوات من الناس
    if (lvl === normalizeArabicSimple('نظام الاربع سنوات ( من سورة الناس )') || lvl === normalizeArabicSimple('أربع سنوات من الناس')) return seniorsFourYearsNasCurriculum;
    // نظام الخمس سنوات من البقرة
    if (lvl === normalizeArabicSimple('نظام الخمس سنوات ( من سورة البقرة )') || lvl === normalizeArabicSimple('خمس سنوات من البقرة') || lvl === normalizeArabicSimple('القرآن الكريم كبار ( نظام الخمس سنوات - من سورة البقرة )')) return seniorsFiveYearsFatihahCurriculum;
    // نظام الخمس سنوات من الناس
    if (lvl === normalizeArabicSimple('نظام الخمس سنوات ( من سورة الناس )') || lvl === normalizeArabicSimple('خمس سنوات من الناس')) return seniorsFiveYearsNasCurriculum;
  }
  return null;
};


