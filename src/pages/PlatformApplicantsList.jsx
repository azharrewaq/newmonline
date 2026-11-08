import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, Trash2, Edit, Video,
  Users, Layers, GitMerge, Clock, Calendar, Printer, RefreshCw
} from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { platformApplicantsAPI } from '../utils/apiService';
import { exportToXLSX, importFromXLSX, exportExamSheetsToXLSX } from '../utils/xlsxHelper';
import { quranSurahs } from '../data/quranSurahs';
import { normalizeArabic } from '../utils/userScopeHelper';
import {
  APPLICANT_ROWAQ_OPTIONS,
  APPLICANT_GENDER_OPTIONS,
  GOVERNORATES_LIST,
  normalizeApplicantGender,
  getLevelsForApplicantRowaq,
  normalizeApplicantRowaq,
  normalizePreferredDays,
  PREFERRED_DAYS_OPTIONS,
  PREFERRED_TIME_OPTIONS,
  PLACEMENT_GROUP_CAPACITY,
  formatTime12Ar,
  normalizeExamDate,
  normalizeExamTime,
  isLegacyDefaultGroupShift,
  getGroupTimeLabel,
  buildExamSheetsByGroupAndCoordinator,
  printPlacementExamSheets,
  rescheduleApplicantDay9,
  splitApplicantsIntoQuarterTimes,
} from '../utils/placementHelpers';

function PlatformApplicantsList() {
  const {
    platformApplicants = [],
    setPlatformApplicants,
    deletePlatformApplicant,
    updatePlatformApplicant,
    deleteAllPlatformApplicants,
    bulkImportPlatformApplicants,
    refreshPlatformApplicants,
    placementGroups = [],
    updatePlacementGroup,
    platformSupervisors = [],
    platformMohfezs = [],
    platformCoordinators = [],
  } = useAppData();

  const importRef = useRef(null);
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const role = currentUser?.role || 'admin';
  const isMohfez = role === 'platform_mohfez' || role === 'mohfez';
  const isCoordinator = role === 'platform_coordinator';
  const isSupervisor = role === 'platform_supervisor';
  const isAdminOrSupervisor = ['admin', 'platform_admin', 'platform_supervisor'].includes(role);

  const [activeTab, setActiveTab] = useState('applicants'); // applicants | groups | compatible
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  // تصحيح فوري لأي متقدمين ما زالوا يحملون تاريخ 9 نوفمبر في الذاكرة المحلية
  useEffect(() => {
    const hasDay9 = platformApplicants.some(a => {
      const d = normalizeExamDate(a.exam_date);
      return d === '2026-11-09' || d === '46335';
    });
    if (hasDay9 && typeof refreshPlatformApplicants === 'function') {
      refreshPlatformApplicants().catch(err => console.error('Auto-refresh Day 9 error:', err));
    }
  }, [platformApplicants, refreshPlatformApplicants]);

  // حالة تسكين مشرف لعدد من المجموعات دفعة واحدة
  const [bulkSupType, setBulkSupType] = useState('scientific_supervisor'); // scientific_supervisor | technical_supervisor
  const [bulkSupName, setBulkSupName] = useState('');
  const [bulkFromGroup, setBulkFromGroup] = useState(1);
  const [bulkToGroup, setBulkToGroup] = useState(10);

  // المشرف العلمي يتم اختياره من قائمة المحفظين، والمشرف التقني يتم اختياره من قائمة المنسقين
  const scientificSupervisorsList = platformMohfezs;
  const technicalSupervisorsList = platformCoordinators;

  // إخفاء رقم تليفون الدارس عن المحفظ والمشرف العلمي
  const isScientificSupervisor = useMemo(() => {
    if (role === 'admin' || role === 'platform_admin') return false;
    if (isMohfez) return true;
    const uName = normalizeArabic(currentUser?.name || '');
    if (!uName) return false;
    if (isSupervisor) {
      const supRec = platformSupervisors.find(s => normalizeArabic(s.name || '') === uName);
      if (supRec?.specialization === 'علمي' || currentUser?.specialization === 'علمي') return true;
    }
    if (platformMohfezs.some(m => normalizeArabic(m.name || '') === uName)) return true;
    if (placementGroups.some(g => g.scientific_supervisor && normalizeArabic(g.scientific_supervisor) === uName)) return true;
    if (platformApplicants.some(a => a.scientific_supervisor && normalizeArabic(a.scientific_supervisor) === uName)) return true;
    return false;
  }, [role, isMohfez, isSupervisor, currentUser, platformSupervisors, platformMohfezs, placementGroups, platformApplicants]);

  const hideStudentPhone = isMohfez || isScientificSupervisor;

  // فلاتر جدول المتقدمين
  const [filterName, setFilterName] = useState('');
  const [filterRowaq, setFilterRowaq] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGroupNo, setFilterGroupNo] = useState('');
  const [filterScientificSupervisor, setFilterScientificSupervisor] = useState('');
  const [filterTechnicalSupervisor, setFilterTechnicalSupervisor] = useState('');
  const [filterCoordinator, setFilterCoordinator] = useState('');
  const [filterShift, setFilterShift] = useState(''); // توقيت الاختبار HH:MM (وفق ما يتم رفعه)
  const [filterExamDate, setFilterExamDate] = useState('');
  const [filterDays, setFilterDays] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // خيارات الطباعة والتصدير (اختيار المجموعة واليوم أو المجموعة كاملة)
  const [printGroupNo, setPrintGroupNo] = useState('');
  const [printDateMode, setPrintDateMode] = useState('ALL'); // 'ALL' | 'SPLIT_BY_DATE' | 'CUSTOM' | 'YYYY-MM-DD'
  const [printCustomDate, setPrintCustomDate] = useState('');
  const [groupRowDateMap, setGroupRowDateMap] = useState({}); // { [group_no]: 'ALL' | 'SPLIT_BY_DATE' | 'YYYY-MM-DD' }

  // تحديد المجموعات التابعة للمحفظ أو المنسق أو المشرف الحالي
  const myGroupNumbers = useMemo(() => {
    const uName = normalizeArabic(currentUser?.name || '');
    if (isSupervisor && uName) {
      const supNums = new Set();
      placementGroups.forEach(g => {
        if (
          (g.scientific_supervisor && normalizeArabic(g.scientific_supervisor) === uName) ||
          (g.technical_supervisor && normalizeArabic(g.technical_supervisor) === uName)
        ) {
          supNums.add(Number(g.group_no));
        }
      });
      // إذا كان المشرف مسكناً على مجموعات محددة يرى مجموعاته، وإلا يرى الكل
      if (supNums.size > 0) return supNums;
    }
    if (isAdminOrSupervisor) return null; // يرى الجميع
    const nums = new Set();
    placementGroups.forEach(g => {
      if (isMohfez && (
        (g.mohfez && normalizeArabic(g.mohfez) === uName) ||
        (g.scientific_supervisor && normalizeArabic(g.scientific_supervisor) === uName)
      )) {
        nums.add(Number(g.group_no));
      }
      if (isCoordinator && (
        (g.coordinator && normalizeArabic(g.coordinator) === uName) ||
        (g.technical_supervisor && normalizeArabic(g.technical_supervisor) === uName)
      )) {
        nums.add(Number(g.group_no));
      }
    });
    return nums;
  }, [isAdminOrSupervisor, isSupervisor, isMohfez, isCoordinator, currentUser, placementGroups]);

  // توقيتات الاختبار المسجلة فعلياً (وفق ما تم رفعه أو إضافته)
  const availableExamTimes = useMemo(() => {
    const set = new Set();
    platformApplicants.forEach(a => {
      const grp = placementGroups.find(g => Number(g.group_no) === Number(a.group_no));
      const tm = normalizeExamTime(a.exam_time || grp?.time_start);
      if (tm) set.add(tm);
    });
    return Array.from(set).sort();
  }, [platformApplicants, placementGroups]);

  // تصفية المتقدمين حسب صلاحية المستخدم (أدمن / مشرف / منسق / محفظ) + الفلاتر
  const filtered = useMemo(() => {
    const uName = normalizeArabic(currentUser?.name || '');
    return platformApplicants.filter(a => {
      if (myGroupNumbers !== null) {
        const gNo = Number(a.group_no);
        const byGroup = gNo && myGroupNumbers.has(gNo);
        const byMohfez = isMohfez && (
          (a.mohfez && normalizeArabic(a.mohfez) === uName) ||
          (a.scientific_supervisor && normalizeArabic(a.scientific_supervisor) === uName)
        );
        const byCoord = isCoordinator && (
          (a.coordinator && normalizeArabic(a.coordinator) === uName) ||
          (a.technical_supervisor && normalizeArabic(a.technical_supervisor) === uName)
        );
        const bySup = isSupervisor && (
          (a.scientific_supervisor && normalizeArabic(a.scientific_supervisor) === uName) ||
          (a.technical_supervisor && normalizeArabic(a.technical_supervisor) === uName)
        );
        if (!byGroup && !byMohfez && !byCoord && !bySup) return false;
      }

      if (filterName) {
        const qNorm = normalizeArabic(filterName);
        const qRaw = filterName.trim();
        const matchName = normalizeArabic(a.name || '').includes(qNorm);
        const matchNid = String(a.national_id || a.passport_no || '').includes(qRaw);
        if (!matchName && !matchNid) return false;
      }

      const normRowaq = normalizeApplicantRowaq(a.rowaq, a.gender);
      if (filterRowaq && normRowaq !== filterRowaq) return false;
      const appLevel = a.applied_level || a.level || '';
      const testLevel = a.tested_level || '';
      if (filterLevel && appLevel !== filterLevel && testLevel !== filterLevel) return false;
      if (filterGroupNo && String(a.group_no || '') !== String(filterGroupNo)) return false;
      const grp = placementGroups.find(g => Number(g.group_no) === Number(a.group_no));
      if (filterScientificSupervisor) {
        const aSci = a.scientific_supervisor || grp?.scientific_supervisor || '';
        if (normalizeArabic(aSci) !== normalizeArabic(filterScientificSupervisor)) return false;
      }
      if (filterTechnicalSupervisor) {
        const aTech = a.technical_supervisor || grp?.technical_supervisor || '';
        if (normalizeArabic(aTech) !== normalizeArabic(filterTechnicalSupervisor)) return false;
      }
      if (filterCoordinator) {
        const aCoord = a.coordinator || grp?.coordinator || '';
        if (normalizeArabic(aCoord) !== normalizeArabic(filterCoordinator)) return false;
      }
      if (filterShift && normalizeExamTime(a.exam_time || grp?.time_start) !== filterShift) return false;
      if (filterExamDate && normalizeExamDate(a.exam_date) !== filterExamDate) return false;
      if (filterDays && normalizePreferredDays(a.preferred_days || '') !== filterDays) return false;
      if (filterTime && (a.preferred_time || '') !== filterTime) return false;

      return true;
    });
  }, [
    platformApplicants, isSupervisor, isMohfez, isCoordinator,
    currentUser, myGroupNumbers, filterName, filterRowaq, filterLevel,
    filterGroupNo, filterScientificSupervisor, filterTechnicalSupervisor,
    filterCoordinator, placementGroups, filterShift, filterExamDate, filterDays, filterTime
  ]);

  // ترتيب النتائج: المضافون يدوياً وحديثاً يظهرون في الصدارة فوراً على الصفحة الأولى
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aTime = Number(a.id) > 1700000000000 ? Number(a.id) : 0;
      const bTime = Number(b.id) > 1700000000000 ? Number(b.id) : 0;
      if (aTime !== bTime) return bTime - aTime; // الأحدث إضافة أولاً
      const ga = Number(a.group_no) || 999;
      const gb = Number(b.group_no) || 999;
      if (ga !== gb) return ga - gb;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFiltered.slice(start, start + pageSize);
  }, [sortedFiltered, currentPage]);

  // تحديث حقل للمتقدم مباشرة من الجدول (القوائم المنسدلة المترابطة)
  const handleInlineUpdate = (applicant, field, value) => {
    const patch = { [field]: value };
    if (field === 'rowaq') {
      patch.level = '';
      patch.applied_level = '';
      patch.tested_level = '';
      if (value.includes('سيدات') || value.includes('نساء')) patch.gender = 'أنثى';
      else if (value.includes('رجال')) patch.gender = 'ذكر';
    }
    if (field === 'applied_level') {
      patch.level = value;
    }
    if (field === 'group_no') {
      const grp = placementGroups.find(g => String(g.group_no) === String(value));
      if (grp) {
        patch.scientific_supervisor = grp.scientific_supervisor || applicant.scientific_supervisor || '';
        patch.technical_supervisor = grp.technical_supervisor || applicant.technical_supervisor || '';
        patch.mohfez = grp.mohfez || applicant.mohfez || '';
        patch.coordinator = grp.coordinator || applicant.coordinator || '';
        patch.exam_time = (!isLegacyDefaultGroupShift(grp) && grp.time_start) || applicant.exam_time || '';
        patch.teams_link = grp.teams_link || applicant.teams_link || '';
      }
    }
    // إذا تم تحديد الرواق والمستوى والسورة نحدّث الحالة تلقائياً إلى "تم تحديد المستوى"
    const nextRowaq = field === 'rowaq' ? value : applicant.rowaq;
    const nextTested = field === 'tested_level' ? value : (field === 'rowaq' ? '' : applicant.tested_level);
    const nextApplied = field === 'applied_level' ? value : (field === 'rowaq' ? '' : (applicant.applied_level || applicant.level));
    const nextSurah = field === 'stopped_surah' ? value : applicant.stopped_surah;
    if (nextRowaq && (nextTested || (nextApplied && nextSurah))) {
      patch.status = 'تم تحديد المستوى';
    }
    updatePlatformApplicant(applicant.id, patch);
  };

  // تحديث بيانات إحدى المجموعات الـ 40 + عكسها على المتقدمين المسكنين فيها
  const handleGroupUpdate = (group, field, value) => {
    // المنسق الإداري يستطيع تسكين المحفظ أو تعديل توقيت مجموعاته
    if (!isAdminOrSupervisor && !(isCoordinator && ['mohfez', 'time_start', 'time_end'].includes(field))) return;
    if (field === 'time_start' || field === 'time_end') {
      const wasLegacy = isLegacyDefaultGroupShift(group);
      const patch = wasLegacy
        ? {
            time_start: field === 'time_start' ? value : '',
            time_end: field === 'time_end' ? value : '',
            shift_label: '',
          }
        : { [field]: value, shift_label: '' };
      updatePlacementGroup(group.id, patch);
      return;
    }
    updatePlacementGroup(group.id, { [field]: value });
  };

  // تسكين مشرف علمي أو مشرف تقني لعدد من المجموعات دفعة واحدة
  const handleBulkAssignSupervisor = () => {
    const from = Math.max(1, Math.min(40, Number(bulkFromGroup) || 1));
    const to = Math.max(from, Math.min(40, Number(bulkToGroup) || from));
    const targetGroups = placementGroups.filter(g => g.group_no >= from && g.group_no <= to);
    targetGroups.forEach(g => {
      updatePlacementGroup(g.id, { [bulkSupType]: bulkSupName });
    });
    const label = bulkSupType === 'scientific_supervisor' ? 'المشرف العلمي' : 'المشرف التقني';
    alert(
      bulkSupName
        ? `تم تسكين ${label} (${bulkSupName}) على المجموعات من (${from}) إلى (${to}) بنجاح`
        : `تم إخلاء خانة ${label} للمجموعات من (${from}) إلى (${to})`
    );
  };

  // الأيام المسجلة فعلياً في بيانات المتقدمين (مع عدد الدارسين لكل يوم حسب المجموعة المختارة في خيارات الطباعة)
  const availableExamDatesForPrint = useMemo(() => {
    const counts = new Map();
    platformApplicants.forEach(a => {
      if (printGroupNo && String(a.group_no || '') !== String(printGroupNo)) return;
      if (myGroupNumbers !== null && (!a.group_no || !myGroupNumbers.has(Number(a.group_no)))) return;
      const d = normalizeExamDate(a.exam_date);
      if (!d) return;
      counts.set(d, (counts.get(d) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [platformApplicants, printGroupNo, myGroupNumbers]);

  // بناء الكشوف وفق خيارات الطباعة المحددة (المجموعة + اليوم أو المجموعة كاملة)
  const buildSheetsFromPrintOptions = () => {
    const effectiveGroupNo = printGroupNo || filterGroupNo || '';
    const resolvedDate =
      printDateMode === 'CUSTOM'
        ? normalizeExamDate(printCustomDate)
        : printDateMode === 'ALL'
          ? ''
          : printDateMode; // 'SPLIT_BY_DATE' أو تاريخ محدد YYYY-MM-DD

    const baseApplicants = effectiveGroupNo
      ? platformApplicants.filter(a => String(a.group_no || '') === String(effectiveGroupNo))
      : filtered;

    return buildExamSheetsByGroupAndCoordinator(baseApplicants, placementGroups, {
      targetGroupNo: effectiveGroupNo,
      targetCoordinator: filterCoordinator,
      targetDate: resolvedDate,
      splitByDate: printDateMode === 'SPLIT_BY_DATE',
      padToCapacity: Boolean(effectiveGroupNo),
    });
  };

  // طباعة كشوف الاختبار حسب خيارات الطباعة (المجموعة واليوم أو المجموعة كاملة)
  const handlePrintExamSheets = () => {
    const sheets = buildSheetsFromPrintOptions();
    printPlacementExamSheets(sheets);
  };

  // طباعة كشف مجموعة واحدة محددة (من تبويب المجموعات الـ 40) مع خيار اليوم أو المجموعة كاملة
  const handlePrintGroupSheet = (group) => {
    const rowMode = groupRowDateMap[group.group_no] || (filterExamDate ? filterExamDate : 'ALL');
    const targetDate = rowMode === 'ALL' ? '' : rowMode;
    const groupApplicants = platformApplicants.filter(a => Number(a.group_no) === Number(group.group_no));
    const sheets = buildExamSheetsByGroupAndCoordinator(groupApplicants, placementGroups, {
      targetGroupNo: group.group_no,
      targetCoordinator: group.coordinator || '',
      targetDate,
      splitByDate: rowMode === 'SPLIT_BY_DATE',
      padToCapacity: true,
    });
    printPlacementExamSheets(sheets);
  };

  // طباعة كشوف جميع الـ 40 مجموعة دفعة واحدة
  const handlePrintAllFortyGroups = () => {
    const resolvedDate =
      printDateMode === 'CUSTOM'
        ? normalizeExamDate(printCustomDate)
        : printDateMode === 'ALL' || printDateMode === 'SPLIT_BY_DATE'
          ? normalizeExamDate(filterExamDate)
          : normalizeExamDate(printDateMode);

    const allSheets = [];
    placementGroups.forEach(group => {
      if (myGroupNumbers !== null && !myGroupNumbers.has(Number(group.group_no))) return;
      const groupApplicants = platformApplicants.filter(a => Number(a.group_no) === Number(group.group_no));
      const sheets = buildExamSheetsByGroupAndCoordinator(groupApplicants, placementGroups, {
        targetGroupNo: group.group_no,
        targetCoordinator: group.coordinator || '',
        targetDate: printDateMode === 'SPLIT_BY_DATE' ? 'SPLIT_BY_DATE' : resolvedDate,
        splitByDate: printDateMode === 'SPLIT_BY_DATE',
        padToCapacity: true,
      });
      allSheets.push(...sheets);
    });
    printPlacementExamSheets(allSheets);
  };

  // تصدير كشوف الاختبار إلى ملف Excel حسب خيارات الطباعة (المجموعة واليوم أو المجموعة كاملة)
  const handleExportExamSheetsExcel = () => {
    const sheets = buildSheetsFromPrintOptions();
    const effectiveGroupNo = printGroupNo || filterGroupNo || '';
    const suffix = effectiveGroupNo ? `_مجموعة_${effectiveGroupNo}` : '';
    exportExamSheetsToXLSX(sheets, `كشف_تحديد_مستوى_المنصة_المحلية_بالجامع_الأزهر${suffix}`);
  };

  // تصدير كشف مجموعة واحدة محددة إلى Excel (مع خيار اليوم أو المجموعة كاملة)
  const handleExportGroupSheetExcel = (group) => {
    const rowMode = groupRowDateMap[group.group_no] || (filterExamDate ? filterExamDate : 'ALL');
    const targetDate = rowMode === 'ALL' ? '' : rowMode;
    const groupApplicants = platformApplicants.filter(a => Number(a.group_no) === Number(group.group_no));
    const sheets = buildExamSheetsByGroupAndCoordinator(groupApplicants, placementGroups, {
      targetGroupNo: group.group_no,
      targetCoordinator: group.coordinator || '',
      targetDate,
      splitByDate: rowMode === 'SPLIT_BY_DATE',
      padToCapacity: true,
    });
    const dateSuffix = targetDate && targetDate !== 'SPLIT_BY_DATE' ? `_${targetDate}` : '_المجموعة_كاملة';
    exportExamSheetsToXLSX(sheets, `كشف_تحديد_المستوى_مجموعة_${group.group_no}${dateSuffix}`);
  };

  // تصدير كشوف جميع الـ 40 مجموعة دفعة واحدة إلى Excel
  const handleExportAllFortyGroupsExcel = () => {
    const resolvedDate =
      printDateMode === 'CUSTOM'
        ? normalizeExamDate(printCustomDate)
        : printDateMode === 'ALL' || printDateMode === 'SPLIT_BY_DATE'
          ? normalizeExamDate(filterExamDate)
          : normalizeExamDate(printDateMode);

    const allSheets = [];
    placementGroups.forEach(group => {
      if (myGroupNumbers !== null && !myGroupNumbers.has(Number(group.group_no))) return;
      const groupApplicants = platformApplicants.filter(a => Number(a.group_no) === Number(group.group_no));
      const sheets = buildExamSheetsByGroupAndCoordinator(groupApplicants, placementGroups, {
        targetGroupNo: group.group_no,
        targetCoordinator: group.coordinator || '',
        targetDate: printDateMode === 'SPLIT_BY_DATE' ? 'SPLIT_BY_DATE' : resolvedDate,
        splitByDate: printDateMode === 'SPLIT_BY_DATE',
        padToCapacity: true,
      });
      allSheets.push(...sheets);
    });
    exportExamSheetsToXLSX(allSheets, 'كشوف_تحديد_المستوى_40_مجموعة_الجامع_الأزهر_نوفمبر_2026');
  };

  // ترحيل دارسي يوم 9 نوفمبر إلى ما بعد اليوم الأخير لكل مجموعة
  const handleRescheduleDay9 = async () => {
    if (!window.confirm('هل تريد بالتأكيد ترحيل دارسي يوم 9 نوفمبر إلى ما بعد اليوم الأخير لكل مجموعة (أيام 13 و 14 و 15 نوفمبر)؟')) return;
    try {
      const res = await platformApplicantsAPI.rescheduleDay9();
      if (res && res.success) {
        alert(`تم الترحيل بنجاح في قاعدة البيانات!\n\n- إلى 13 نوفمبر: ${res.movedTo13} دارساً\n- إلى 14 نوفمبر: ${res.movedTo14} دارساً\n- إلى 15 نوفمبر: ${res.movedTo15} دارساً\n\nإجمالي الدارسين المرحلين: ${res.totalRescheduled} دارساً`);
        window.location.reload();
      } else {
        alert('حدث خطأ أثناء الترحيل.');
      }
    } catch (err) {
      alert('فشل الترحيل: ' + err.message);
    }
  };

  // تقسيم مواعيد اختبار كل مجموعة (ساعتين) إلى 4 مواعيد بالتساوي (نصف ساعة لكل ربع دارسين)
  const handleSplitQuarterTimes = async () => {
    if (!window.confirm(
      'هل تريد تقسيم مواعيد اختبار كل مجموعة (من 6 إلى 8 مساءً) إلى 4 مواعيد بالتساوي (نصف ساعة لكل ربع من الدارسين)؟\n\n' +
      '• جميع المجموعات (من 1 إلى 40) من 6 إلى 8 مساءً:\n' +
      '  - الربع الأول: 06:00 م - 06:30 م\n' +
      '  - الربع الثاني: 06:30 م - 07:00 م\n' +
      '  - الربع الثالث: 07:00 م - 07:30 م\n' +
      '  - الربع الرابع: 07:30 م - 08:00 م'
    )) return;

    setIsSplitting(true);
    try {
      const res = await platformApplicantsAPI.splitGroupTimes();
      const updated = splitApplicantsIntoQuarterTimes(platformApplicants);
      if (typeof setPlatformApplicants === 'function') {
        setPlatformApplicants(updated);
      }
      localStorage.setItem('platformApplicants', JSON.stringify(updated));
      alert(`تم تقسيم مواعيد المجموعات بنجاح في قاعدة البيانات!\nعدد الدارسين الذين تم تعيين المواعيد لهم: ${res.totalAssigned || updated.length} دارساً`);
      if (typeof refreshPlatformApplicants === 'function') {
        await refreshPlatformApplicants();
      }
    } catch (err) {
      const updated = splitApplicantsIntoQuarterTimes(platformApplicants);
      if (typeof setPlatformApplicants === 'function') {
        setPlatformApplicants(updated);
      }
      localStorage.setItem('platformApplicants', JSON.stringify(updated));
      alert('تم تطبيق تقسيم المواعيد محلياً بنجاح!');
    } finally {
      setIsSplitting(false);
    }
  };

  // تحديث البيانات يدوياً من السيرفر مباشرة
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (typeof refreshPlatformApplicants === 'function') {
        await refreshPlatformApplicants();
      }
      alert('تم تحديث البيانات من قاعدة البيانات بنجاح!');
    } catch (err) {
      alert('فشل تحديث البيانات من السيرفر: ' + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // تصدير جدول المتقدمين الحالي إلى Excel (متطابق 100% مع ترتيب وتوقيتات الموقع المعروضة)
  const handleExport = () => {
    if (hideStudentPhone) return;
    const effectiveList = sortedFiltered;
    const exportData = effectiveList.map(a => {
      const grp = placementGroups.find(g => Number(g.group_no) === Number(a.group_no));
      const displayExamTime = a.exam_time ? formatTime12Ar(a.exam_time) : (getGroupTimeLabel(grp, [a]) || '');
      return {
        'الاسم': a.name || '',
        'الرقم القومي أو جواز السفر': a.national_id || a.passport_no || '',
        'النوع': normalizeApplicantGender(a.gender, a.rowaq) || '',
        'المحافظة': a.governorate || '',
        ...(hideStudentPhone ? {} : { 'رقم التليفون': a.phone || '' }),
        'الرواق': normalizeApplicantRowaq(a.rowaq, a.gender) || '',
        'المستوى وفق الاختبار': a.tested_level || '',
        'السورة المتوقف عندها': a.stopped_surah || '',
        'الأيام المناسبة': normalizePreferredDays(a.preferred_days) || '',
        'التوقيت المناسب': a.preferred_time || '',
        'رقم المجموعة': a.group_no || '',
        'فترة المجموعة': getGroupTimeLabel(grp, [a]),
        'المشرف العلمي': a.scientific_supervisor || grp?.scientific_supervisor || '',
        'المشرف التقني': a.technical_supervisor || grp?.technical_supervisor || '',
        'المحفظ': a.mohfez || grp?.mohfez || '',
        'المنسق': a.coordinator || grp?.coordinator || '',
        'تاريخ الاختبار': normalizeExamDate(a.exam_date) || '',
        'توقيت الاختبار': displayExamTime,
        'رابط تيمز': a.teams_link || grp?.teams_link || '',
      };
    });
    exportToXLSX(exportData, 'المتقدمين_الجدد_تحديد_المستوى', 'المتقدمين الجدد');
  };

  // تصدير نموذج الاستيراد المعتمد (مع قوائم منسدلة مرتبطة بشيت المسميات)
  const handleExportTemplate = () => {
    exportToXLSX([{
      'الاسم': '',
      'الرقم القومي أو جواز السفر': '',
      'النوع': '',
      'المحافظة': '',
      'رقم التليفون': '',
      'الرواق': '',
      'المستوى وفق الاختبار': '',
      'السورة المتوقف عندها': '',
      'الأيام المناسبة': '',
      'التوقيت المناسب': '',
      'رقم المجموعة': '',
      'المشرف العلمي': '',
      'المشرف التقني': '',
      'المحفظ': '',
      'المنسق': '',
      'تاريخ الاختبار': '',
      'توقيت الاختبار': '',
      'رابط تيمز': '',
    }], 'نموذج_استيراد_المتقدمين_الجدد', 'نموذج');
  };

  // استيراد دفعة كبيرة (حتى 6000 متقدم) من ملف Excel
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      if (!rows || rows.length === 0) {
        alert('الملف فارغ أو يحتوي على بيانات غير صالحة');
        return;
      }

      const existingMap = new Map(
        platformApplicants
          .filter(a => String(a.national_id || a.passport_no || '').trim())
          .map(a => [String(a.national_id || a.passport_no || '').trim(), a])
      );
      const seenNids = new Set();

      const newApplicants = [];
      const newUsers = [];
      let updatedCount = 0;

      rows.forEach((row, idx) => {
        const nid = String(
          row['الرقم القومي أو جواز السفر'] ||
          row['الرقم القومي او جواز السفر'] ||
          row['الرقم القومي'] ||
          row['الرقم القومى'] ||
          row['رقم جواز السفر'] ||
          ''
        ).trim();
        const name = String(row['الاسم'] || '').trim();
        if (!nid && !name) return;
        if (name.startsWith('توقيع المحفظ') || name.startsWith('الجامع الأزهر') || name.startsWith('المجموعة:')) return;

        const rawRowaq = row['الرواق'] || '';
        const rawGender = row['النوع'] || row['الجنس'] || '';
        const normRowaq = normalizeApplicantRowaq(rawRowaq, rawGender);
        const gender = normalizeApplicantGender(rawGender, normRowaq);
        const governorate = String(row['المحافظة'] || '').trim();
        const appliedLevel = String(row['المستوى المتقدم عليه'] || row['المستوى'] || '').trim();
        const testedLevel = String(row['المستوى وفق الاختبار'] || '').trim();
        const level = testedLevel || appliedLevel;
        const stoppedSurah = String(row['السورة المتوقف عندها'] || row['السورة'] || '').replace(/^سورة\s+/, '').trim();
        const preferredDays = normalizePreferredDays(String(row['الأيام المناسبة'] || row['الايام المناسبة'] || '').trim());
        const preferredTime = String(row['التوقيت المناسب'] || row['الساعة المناسبة'] || '').trim();
        const q1 = row['درجة السؤال الأول'] ?? row['درجة السؤال الاول'] ?? '';
        const q2 = row['درجة السؤال الثانى'] ?? row['درجة السؤال الثاني'] ?? '';
        const q3 = row['درجة السؤال الثالث'] ?? '';
        const q4 = row['درجة السؤال الرابع'] ?? '';
        const q5 = row['درجة السؤال الخامس'] ?? '';

        const groupNoRaw = row['رقم المجموعة'] || row['المجموعة'] || '';
        const groupNo = groupNoRaw ? Number(groupNoRaw) : '';
        const matchedGroup = groupNo ? placementGroups.find(g => Number(g.group_no) === Number(groupNo)) : null;

        const scientificSupervisor = String(row['المشرف العلمي'] || row['المشرف العلمى'] || matchedGroup?.scientific_supervisor || '').trim();
        const technicalSupervisor = String(row['المشرف التقني'] || row['المشرف التقنى'] || matchedGroup?.technical_supervisor || '').trim();
        const mohfez = String(row['المحفظ'] || matchedGroup?.mohfez || '').trim();
        const coordinator = String(row['المنسق'] || matchedGroup?.coordinator || '').trim();
        const examDate = normalizeExamDate(row['تاريخ الاختبار'] || '');
        const groupCustomStart = matchedGroup && !isLegacyDefaultGroupShift(matchedGroup) ? matchedGroup.time_start : '';
        const examTime = normalizeExamTime(row['توقيت الاختبار'] || groupCustomStart || '');
        const teamsLink = String(row['رابط تيمز'] || row['رابط الحلقة'] || matchedGroup?.teams_link || '').trim();
        const phone = String(row['رقم التليفون'] || row['رقم الهاتف'] || row['الهاتف'] || row['التليفون'] || '').trim();

        // إذا كان المتقدم موجوداً بالفعل، نحدّث بياناته ونتيجة اختباره من الكشف
        if (nid && existingMap.has(nid)) {
          const ex = existingMap.get(nid);
          const patch = {};
          if (name) patch.name = name;
          if (gender) patch.gender = gender;
          if (governorate) patch.governorate = governorate;
          if (phone) patch.phone = phone;
          if (normRowaq && APPLICANT_ROWAQ_OPTIONS.includes(normRowaq)) {
            patch.rowaq = normRowaq;
            if (!patch.gender) patch.gender = normalizeApplicantGender('', normRowaq);
          }
          if (appliedLevel) patch.applied_level = appliedLevel;
          if (testedLevel) patch.tested_level = testedLevel;
          if (level) patch.level = level;
          if (stoppedSurah) patch.stopped_surah = stoppedSurah;
          if (preferredDays) patch.preferred_days = preferredDays;
          if (preferredTime) patch.preferred_time = preferredTime;
          if (q1 !== '') patch.q1 = q1;
          if (q2 !== '') patch.q2 = q2;
          if (q3 !== '') patch.q3 = q3;
          if (q4 !== '') patch.q4 = q4;
          if (q5 !== '') patch.q5 = q5;
          if (groupNo) patch.group_no = groupNo;
          if (scientificSupervisor) patch.scientific_supervisor = scientificSupervisor;
          if (technicalSupervisor) patch.technical_supervisor = technicalSupervisor;
          if (mohfez) patch.mohfez = mohfez;
          if (coordinator) patch.coordinator = coordinator;
          if (examDate) patch.exam_date = examDate;
          if (examTime) patch.exam_time = examTime;
          if (teamsLink) patch.teams_link = teamsLink;
          if ((patch.rowaq || ex.rowaq) && (patch.tested_level || ex.tested_level || ((patch.applied_level || ex.applied_level || ex.level) && (patch.stopped_surah || ex.stopped_surah)))) {
            patch.status = 'تم تحديد المستوى';
          }
          updatePlatformApplicant(ex.id, patch);
          updatedCount++;
          return;
        }

        if (nid && seenNids.has(nid)) return;
        if (nid) seenNids.add(nid);

        const id = String(Date.now() + idx + Math.random());

        newApplicants.push({
          id,
          name,
          national_id: nid,
          passport_no: nid,
          phone,
          governorate,
          rowaq: APPLICANT_ROWAQ_OPTIONS.includes(normRowaq) ? normRowaq : '',
          gender,
          level,
          applied_level: appliedLevel,
          tested_level: testedLevel,
          stopped_surah: stoppedSurah,
          preferred_days: preferredDays,
          preferred_time: preferredTime,
          q1,
          q2,
          q3,
          q4,
          q5,
          group_no: groupNo,
          scientific_supervisor: scientificSupervisor,
          technical_supervisor: technicalSupervisor,
          mohfez,
          coordinator,
          exam_date: examDate,
          exam_time: examTime,
          teams_link: teamsLink,
          status: (normRowaq && level && stoppedSurah) ? 'تم تحديد المستوى' : 'في انتظار الاختبار',
          username: nid,
          password: nid,
          register_date: row['تاريخ التسجيل'] || new Date().toLocaleDateString('ar-EG'),
        });

        if (nid) {
          newUsers.push({
            id: String(Date.now() + idx + Math.random()),
            name,
            email: nid,
            username: nid,
            password: nid,
            record_number: nid,
            phone,
            role: 'student',
            national_id: nid,
          });
        }
      });

      if (newApplicants.length === 0 && updatedCount === 0) {
        alert('لم يتم العثور على سجلات صالحة للاستيراد.');
        e.target.value = '';
        return;
      }

      if (newApplicants.length > 0) {
        await bulkImportPlatformApplicants(newApplicants, newUsers);
      }
      alert(`تم بنجاح: إضافة (${newApplicants.length}) متقدم جديد${updatedCount > 0 ? ` وتحديث (${updatedCount}) متقدم` : ''}`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء استيراد الملف');
    }
    e.target.value = '';
  };

  // تجميع المتقدمين المتوافقين في المستوى والرواق والسورة والأيام والتوقيت لدمجهم في الحلقات الأصلية لاحقاً
  const compatibleBuckets = useMemo(() => {
    const map = {};
    platformApplicants.forEach(a => {
      const r = normalizeApplicantRowaq(a.rowaq, a.gender);
      const effLevel = a.tested_level || a.applied_level || a.level || '';
      if (!r || !effLevel) return;
      const normDays = normalizePreferredDays(a.preferred_days);
      const key = `${r} || ${effLevel} || ${a.stopped_surah || 'غير محدد'} || ${normDays || 'غير محدد'} || ${a.preferred_time || 'غير محدد'}`;
      if (!map[key]) {
        map[key] = {
          key,
          rowaq: r,
          level: effLevel,
          stopped_surah: a.stopped_surah || '-',
          preferred_days: normDays || '-',
          preferred_time: a.preferred_time || '-',
          members: [],
        };
      }
      map[key].members.push(a);
    });
    return Object.values(map).sort((a, b) => b.members.length - a.members.length);
  }, [platformApplicants]);

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="title-section">
          <h2>المتقدمون الجدد وخطة تحديد المستوى</h2>
          <p>
            40 مجموعة اختبار يومياً (سعة كل مجموعة 25 دارساً) — يتم تحديد توقيت وفترة كل مجموعة حسب إدخال المستخدمين
          </p>
        </div>
      </div>

      {/* شريط التبويبات */}
      <div className="box-card" style={{ display: 'flex', gap: 10, padding: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'applicants' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('applicants')}
        >
          <Users size={16} /> جدول المتقدمين وتحديد المستوى ({filtered.length})
        </button>
        <button
          className={`btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('groups')}
        >
          <Layers size={16} /> المجموعات اليومية الـ 40
        </button>
        {isAdminOrSupervisor && (
          <button
            className={`btn ${activeTab === 'compatible' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('compatible')}
          >
            <GitMerge size={16} /> المجموعات المتوافقة للدمج في الحلقات الأصلية ({compatibleBuckets.length})
          </button>
        )}
      </div>

      {/* ───────── التبويب الأول: جدول المتقدمين الجدد وتحديد المستوى ───────── */}
      {activeTab === 'applicants' && (
        <>
          <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 15 }}>
              <div className="form-group">
                <label>الاسم أو الرقم القومي/الجواز</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ابحث بالاسم أو الرقم..."
                  value={filterName}
                  onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="form-group">
                <label>الرواق</label>
                <select
                  className="form-select"
                  value={filterRowaq}
                  onChange={e => { setFilterRowaq(e.target.value); setFilterLevel(''); setCurrentPage(1); }}
                >
                  <option value="">--- كل الأروقة ---</option>
                  {APPLICANT_ROWAQ_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>المستوى</label>
                <select
                  className="form-select"
                  value={filterLevel}
                  onChange={e => { setFilterLevel(e.target.value); setCurrentPage(1); }}
                  disabled={!filterRowaq}
                >
                  <option value="">{filterRowaq ? '--- كل المستويات ---' : 'اختر الرواق أولاً'}</option>
                  {getLevelsForApplicantRowaq(filterRowaq).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>المجموعة</label>
                <select
                  className="form-select"
                  value={filterGroupNo}
                  onChange={e => { setFilterGroupNo(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل المجموعات (1 - 40) ---</option>
                  <optgroup label="المجموعات 1 - 20">
                    {placementGroups.filter(g => g.group_no <= 20).map(g => (
                      <option key={g.group_no} value={g.group_no}>
                        مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="المجموعات 21 - 40">
                    {placementGroups.filter(g => g.group_no > 20).map(g => (
                      <option key={g.group_no} value={g.group_no}>
                        مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <label>المشرف العلمي (من المحفظين)</label>
                <select
                  className="form-select"
                  value={filterScientificSupervisor}
                  onChange={e => { setFilterScientificSupervisor(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل المشرفين العلميين ---</option>
                  {scientificSupervisorsList.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>المشرف التقني (من المنسقين)</label>
                <select
                  className="form-select"
                  value={filterTechnicalSupervisor}
                  onChange={e => { setFilterTechnicalSupervisor(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل المشرفين التقنيين ---</option>
                  {technicalSupervisorsList.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>المنسق المشرف</label>
                <select
                  className="form-select"
                  value={filterCoordinator}
                  onChange={e => { setFilterCoordinator(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل المنسقين ---</option>
                  {platformCoordinators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>توقيت الاختبار</label>
                <select
                  className="form-select"
                  value={filterShift}
                  onChange={e => { setFilterShift(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل التوقيتات ---</option>
                  {availableExamTimes.map(tm => <option key={tm} value={tm}>{formatTime12Ar(tm)}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>تاريخ يوم الاختبار</label>
                <input
                  type="date"
                  className="form-input"
                  value={filterExamDate}
                  onChange={e => { setFilterExamDate(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="form-group">
                <label>الأيام المناسبة للدارس</label>
                <select
                  className="form-select"
                  value={filterDays}
                  onChange={e => { setFilterDays(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- الكل ---</option>
                  {PREFERRED_DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>التوقيت المناسب للدارس</label>
                <select
                  className="form-select"
                  value={filterTime}
                  onChange={e => { setFilterTime(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- الكل ---</option>
                  {PREFERRED_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="search-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setFilterName(''); setFilterRowaq(''); setFilterLevel('');
                  setFilterGroupNo(''); setFilterScientificSupervisor(''); setFilterTechnicalSupervisor('');
                  setFilterCoordinator(''); setFilterShift(''); setFilterExamDate('');
                  setFilterDays(''); setFilterTime(''); setCurrentPage(1);
                }}
              >
                إعادة تعيين
              </button>
              <button className="btn btn-primary" style={{ marginRight: 10 }}>
                <Search size={16} /> بحث
              </button>
            </div>
          </div>

          {/* ───────── شريط خيارات الطباعة والتصدير (اختيار المجموعة واليوم أو المجموعة كاملة) ───────── */}
          <div className="box-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Printer size={18} /> خيارات طباعة وتصدير كشوف الاختبار (اختيار المجموعة واليوم أو المجموعة كاملة):
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
                <label style={{ fontSize: 13 }}>اختيار المجموعة</label>
                <select
                  className="form-select"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={printGroupNo}
                  onChange={e => setPrintGroupNo(e.target.value)}
                >
                  <option value="">جميع المجموعات المتاحة (حسب الفلتر)</option>
                  <optgroup label="المجموعات 1 - 20">
                    {placementGroups
                      .filter(g => g.group_no <= 20 && (myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no))))
                      .map(g => {
                        const cnt = platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no)).length;
                        return (
                          <option key={g.group_no} value={g.group_no}>
                            مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''} ({cnt} دارس)
                          </option>
                        );
                      })}
                  </optgroup>
                  <optgroup label="المجموعات 21 - 40">
                    {placementGroups
                      .filter(g => g.group_no > 20 && (myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no))))
                      .map(g => {
                        const cnt = platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no)).length;
                        return (
                          <option key={g.group_no} value={g.group_no}>
                            مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''} ({cnt} دارس)
                          </option>
                        );
                      })}
                  </optgroup>
                </select>
              </div>

              <div className="form-group" style={{ minWidth: 260, flex: 1, marginBottom: 0 }}>
                <label style={{ fontSize: 13 }}>اختيار اليوم أو المجموعة كاملة</label>
                <select
                  className="form-select"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={printDateMode}
                  onChange={e => setPrintDateMode(e.target.value)}
                >
                  <option value="ALL">المجموعة كاملة (شامل جميع الأيام في كشف واحد)</option>
                  <option value="SPLIT_BY_DATE">المجموعة كاملة (مقسمة كشف مستقل لكل يوم)</option>
                  {availableExamDatesForPrint.length > 0 && (
                    <optgroup label="الأيام المسجلة في المجموعة">
                      {availableExamDatesForPrint.map(item => (
                        <option key={item.date} value={item.date}>
                          يوم {item.date} ({item.count} دارس)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="CUSTOM">تحديد تاريخ يوم آخر من التقويم...</option>
                </select>
              </div>

              {printDateMode === 'CUSTOM' && (
                <div className="form-group" style={{ width: 170, marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>التاريخ المحدد</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ padding: '7px 10px', fontSize: 13 }}
                    value={printCustomDate}
                    onChange={e => setPrintCustomDate(e.target.value)}
                  />
                </div>
              )}

              <button className="btn btn-primary" style={{ height: 38 }} onClick={handlePrintExamSheets}>
                <Printer size={16} /> طباعة الكشف حسب الاختيار
              </button>
              <button className="btn btn-gold-outline" style={{ height: 38 }} onClick={handleExportExamSheetsExcel}>
                <Download size={16} /> تصدير الكشف (إكسيل)
              </button>
            </div>
          </div>

          <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
            <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
              {isAdminOrSupervisor && (
                <>
                  <Link to="/platform-applicants/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    <Plus size={16} /> إضافة متقدم
                  </Link>
                  <button
                    className="btn btn-gold-outline"
                    onClick={handleRescheduleDay9}
                    title="ترحيل مواعيد اختبار دارسي يوم 9 نوفمبر إلى ما بعد اليوم الأخير لكل مجموعة"
                    style={{ backgroundColor: 'rgba(212, 175, 55, 0.18)', borderColor: 'var(--accent-gold)', fontWeight: 'bold' }}
                  >
                    <Calendar size={16} /> ترحيل يوم 9 لما بعد اليوم الأخير
                  </button>
                  <button
                    className="btn btn-gold-outline"
                    onClick={handleSplitQuarterTimes}
                    disabled={isSplitting}
                    title="تقسيم مواعيد اختبار الدارسين في كل مجموعة (ساعتين) إلى 4 مواعيد بالتساوي (نصف ساعة لكل ربع دارسين)"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6', fontWeight: 'bold' }}
                  >
                    <Clock size={16} /> {isSplitting ? 'جارٍ تقسيم المواعيد...' : 'تقسيم مواعيد المجموعات (نصف ساعة)'}
                  </button>
                  <button className="btn btn-gold-outline" onClick={() => importRef.current.click()}>
                    <Upload size={16} /> استيراد من إكسيل
                  </button>
                  <button className="btn btn-outline" onClick={handleExportTemplate}>
                    <Download size={16} /> تصدير نموذج الإكسيل
                  </button>
                  <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
                  {platformApplicants.length > 0 && (
                    <button className="btn btn-danger" onClick={deleteAllPlatformApplicants}>
                      حذف الجميع
                    </button>
                  )}
                </>
              )}
              <button className="btn btn-gold-outline" onClick={handlePrintExamSheets}>
                <Printer size={16} /> طباعة كشف الاختبار (لكل مجموعة ومنسق)
              </button>
              <button className="btn btn-outline" onClick={handleExportExamSheetsExcel}>
                <Download size={16} /> تصدير كشف الاختبار (إكسيل)
              </button>
              {!hideStudentPhone && (
                <button className="btn btn-outline" onClick={handleExport}>
                  <Download size={16} /> تصدير
                </button>
              )}
              <button
                className="btn btn-outline"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                title="مزامنة فورية وتحديث بيانات المتقدمين والمجموعات من السيرفر مباشرة"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                {isRefreshing ? 'جارٍ التحديث...' : 'تحديث البيانات من السيرفر'}
              </button>
            </div>
            <div className="table-stats">
              إجمالي النتائج ({filtered.length}) — صفحة {currentPage} من {totalPages}
            </div>
          </div>

          <div className="table-wrapper box-card">
            <table className="management-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>م</th>
                  <th style={{ textAlign: 'center' }}>الاسم</th>
                  {!isMohfez && <th style={{ textAlign: 'center' }}>الرقم القومي / جواز السفر</th>}
                  <th style={{ textAlign: 'center' }}>النوع</th>
                  <th style={{ textAlign: 'center' }}>المحافظة</th>
                  {!hideStudentPhone && <th style={{ textAlign: 'center' }}>رقم التليفون</th>}
                  <th style={{ textAlign: 'center' }}>الرواق</th>
                  <th style={{ textAlign: 'center' }}>المستوى وفق الاختبار</th>
                  <th style={{ textAlign: 'center' }}>السورة المتوقف عندها</th>
                  <th style={{ textAlign: 'center' }}>الأيام المناسبة</th>
                  <th style={{ textAlign: 'center' }}>التوقيت المناسب</th>
                  <th style={{ textAlign: 'center' }}>المجموعة</th>
                  <th style={{ textAlign: 'center' }}>تاريخ وتوقيت الاختبار</th>
                  <th style={{ textAlign: 'center' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={15 - (isMohfez ? 1 : 0) - (hideStudentPhone ? 1 : 0)} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      لا توجد بيانات متقدمين حالياً (سيتم تسكين ورفع بيانات الدارسين لاحقاً).
                    </td>
                  </tr>
                ) : (
                  paginated.map((a, idx) => {
                    const rowRowaq = normalizeApplicantRowaq(a.rowaq, a.gender);
                    const rowGender = normalizeApplicantGender(a.gender, rowRowaq);
                    const rowLevels = getLevelsForApplicantRowaq(rowRowaq);
                    const grp = placementGroups.find(g => Number(g.group_no) === Number(a.group_no));
                    const link = a.teams_link || grp?.teams_link || '';
                    return (
                      <tr key={a.id}>
                        <td style={{ textAlign: 'center' }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{a.name}</td>
                        {!isMohfez && (
                          <td style={{ direction: 'ltr', textAlign: 'center' }}>{a.national_id || a.passport_no || '-'}</td>
                        )}
                        <td style={{ minWidth: 95 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={rowGender}
                            onChange={e => handleInlineUpdate(a, 'gender', e.target.value)}
                          >
                            <option value="">-- النوع --</option>
                            {APPLICANT_GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td style={{ minWidth: 120 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.governorate || ''}
                            onChange={e => handleInlineUpdate(a, 'governorate', e.target.value)}
                          >
                            <option value="">-- المحافظة --</option>
                            {GOVERNORATES_LIST.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                          </select>
                        </td>
                        {!hideStudentPhone && (
                          <td style={{ direction: 'ltr', textAlign: 'center' }}>{a.phone || '-'}</td>
                        )}

                        {/* الرواق - قائمة منسدلة */}
                        <td style={{ minWidth: 140 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={rowRowaq}
                            onChange={e => handleInlineUpdate(a, 'rowaq', e.target.value)}
                          >
                            <option value="">-- الرواق --</option>
                            {APPLICANT_ROWAQ_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>

                        {/* المستوى وفق الاختبار (مرتبط بنوع الرواق) */}
                        <td style={{ minWidth: 175 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.tested_level || ''}
                            disabled={!rowRowaq}
                            onChange={e => handleInlineUpdate(a, 'tested_level', e.target.value)}
                          >
                            <option value="">{rowRowaq ? '-- المستوى وفق الاختبار --' : 'اختر الرواق أولاً'}</option>
                            {rowLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                          </select>
                        </td>

                        {/* السورة المتوقف عندها من جميع سور القرآن */}
                        <td style={{ minWidth: 150 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.stopped_surah || ''}
                            onChange={e => handleInlineUpdate(a, 'stopped_surah', e.target.value)}
                          >
                            <option value="">-- السورة --</option>
                            {quranSurahs.map(s => <option key={s.id} value={s.name}>{s.id} - {s.name}</option>)}
                          </select>
                        </td>

                        {/* الأيام المناسبة للدارس */}
                        <td style={{ minWidth: 140 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={normalizePreferredDays(a.preferred_days) || ''}
                            onChange={e => handleInlineUpdate(a, 'preferred_days', e.target.value)}
                          >
                            <option value="">-- اليومان --</option>
                            {PREFERRED_DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>

                        {/* التوقيت المناسب للدارس */}
                        <td style={{ minWidth: 150 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.preferred_time || ''}
                            onChange={e => handleInlineUpdate(a, 'preferred_time', e.target.value)}
                          >
                            <option value="">-- التوقيت --</option>
                            {PREFERRED_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>

                        {/* المجموعة (1 - 40) */}
                        <td style={{ textAlign: 'center', minWidth: 120 }}>
                          {isAdminOrSupervisor ? (
                            <select
                              className="form-select"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              value={a.group_no || ''}
                              onChange={e => handleInlineUpdate(a, 'group_no', e.target.value)}
                            >
                              <option value="">غير مسكن</option>
                              {placementGroups.map(g => (
                                <option key={g.group_no} value={g.group_no}>
                                  مجموعة {g.group_no}{getGroupTimeLabel(g) ? ` (${getGroupTimeLabel(g)})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{a.group_no ? `مجموعة ${a.group_no}` : '-'}</span>
                          )}
                        </td>

                        {/* تاريخ وتوقيت الاختبار */}
                        <td style={{ textAlign: 'center', fontSize: 12, direction: 'ltr' }}>
                          <div>{normalizeExamDate(a.exam_date) || '-'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {a.exam_time ? formatTime12Ar(a.exam_time) : (getGroupTimeLabel(grp, []) || '')}
                          </div>
                        </td>

                        <td className="actions-cell" style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="رابط تيمز للمجموعة"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#10b981',
                                color: '#fff', padding: '4px 8px', borderRadius: 4, textDecoration: 'none', fontSize: 12
                              }}
                            >
                              <Video size={13} /> تيمز
                            </a>
                          )}
                          {isAdminOrSupervisor && (
                            <>
                              <Link
                                to={`/platform-applicants/create?id=${a.id}`}
                                className="action-icon edit"
                                style={{ textDecoration: 'none', color: 'inherit' }}
                                title="تعديل"
                              >
                                <Edit size={16} />
                              </Link>
                              <button className="action-icon delete" title="حذف" onClick={() => deletePlatformApplicant(a.id)}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                السابق
              </button>
              <span style={{ alignSelf: 'center', fontSize: 14 }}>صفحة {currentPage} من {totalPages}</span>
              <button className="btn btn-outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                التالي
              </button>
            </div>
          )}
        </>
      )}

      {/* ───────── التبويب الثاني: المجموعات الـ 40 ───────── */}
      {activeTab === 'groups' && (
        <div>
          <div className="box-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Printer size={18} /> خيارات طباعة وتصدير كشوف المجموعات (اختيار المجموعة واليوم أو المجموعة كاملة):
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
                <label style={{ fontSize: 13 }}>اختيار المجموعة</label>
                <select
                  className="form-select"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={printGroupNo}
                  onChange={e => setPrintGroupNo(e.target.value)}
                >
                  <option value="">جميع المجموعات (40 مجموعة)</option>
                  <optgroup label="المجموعات 1 - 20">
                    {placementGroups
                      .filter(g => g.group_no <= 20 && (myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no))))
                      .map(g => {
                        const cnt = platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no)).length;
                        return (
                          <option key={g.group_no} value={g.group_no}>
                            مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''} ({cnt} دارس)
                          </option>
                        );
                      })}
                  </optgroup>
                  <optgroup label="المجموعات 21 - 40">
                    {placementGroups
                      .filter(g => g.group_no > 20 && (myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no))))
                      .map(g => {
                        const cnt = platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no)).length;
                        return (
                          <option key={g.group_no} value={g.group_no}>
                            مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''} ({cnt} دارس)
                          </option>
                        );
                      })}
                  </optgroup>
                </select>
              </div>

              <div className="form-group" style={{ minWidth: 260, flex: 1, marginBottom: 0 }}>
                <label style={{ fontSize: 13 }}>اختيار اليوم أو المجموعة كاملة</label>
                <select
                  className="form-select"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={printDateMode}
                  onChange={e => setPrintDateMode(e.target.value)}
                >
                  <option value="ALL">المجموعة كاملة (شامل جميع الأيام في كشف واحد)</option>
                  <option value="SPLIT_BY_DATE">المجموعة كاملة (مقسمة كشف مستقل لكل يوم)</option>
                  {availableExamDatesForPrint.length > 0 && (
                    <optgroup label="الأيام المسجلة">
                      {availableExamDatesForPrint.map(item => (
                        <option key={item.date} value={item.date}>
                          يوم {item.date} ({item.count} دارس)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="CUSTOM">تحديد تاريخ يوم آخر من التقويم...</option>
                </select>
              </div>

              {printDateMode === 'CUSTOM' && (
                <div className="form-group" style={{ width: 170, marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>التاريخ المحدد</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ padding: '7px 10px', fontSize: 13 }}
                    value={printCustomDate}
                    onChange={e => setPrintCustomDate(e.target.value)}
                  />
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ height: 38 }}
                onClick={printGroupNo ? handlePrintExamSheets : handlePrintAllFortyGroups}
              >
                <Printer size={16} /> {printGroupNo ? `طباعة مجموعة (${printGroupNo})` : 'طباعة جميع المجموعات'}
              </button>
              <button
                className="btn btn-gold-outline"
                style={{ height: 38 }}
                onClick={printGroupNo ? handleExportExamSheetsExcel : handleExportAllFortyGroupsExcel}
              >
                <Download size={16} /> {printGroupNo ? `تصدير مجموعة (${printGroupNo}) إكسيل` : 'تصدير جميع المجموعات إكسيل'}
              </button>
            </div>
          </div>

          {/* أداة تسكين مشرف علمي أو مشرف تقني لعدد من المجموعات دفعة واحدة */}
          {isAdminOrSupervisor && (
            <div className="box-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: 12 }}>
                تسكين مشرف (علمي / تقني) للإشراف على عدد من المجموعات دفعة واحدة:
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>نوع الإشراف</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                    value={bulkSupType}
                    onChange={e => { setBulkSupType(e.target.value); setBulkSupName(''); }}
                  >
                    <option value="scientific_supervisor">المشرف العلمي (من المحفظين)</option>
                    <option value="technical_supervisor">المشرف التقني (من المنسقين)</option>
                  </select>
                </div>

                <div className="form-group" style={{ minWidth: 230, flex: 1, marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>
                    {bulkSupType === 'scientific_supervisor' ? 'اسم المشرف العلمي (من المحفظين)' : 'اسم المشرف التقني (من المنسقين)'}
                  </label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                    value={bulkSupName}
                    onChange={e => setBulkSupName(e.target.value)}
                  >
                    <option value="">
                      {bulkSupType === 'scientific_supervisor'
                        ? '--- اختر من قائمة المحفظين (أو اتركه فارغاً للإخلاء) ---'
                        : '--- اختر من قائمة المنسقين (أو اتركه فارغاً للإخلاء) ---'}
                    </option>
                    {(bulkSupType === 'scientific_supervisor' ? scientificSupervisorsList : technicalSupervisorsList).map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>من مجموعة رقم</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                    value={bulkFromGroup}
                    onChange={e => setBulkFromGroup(Number(e.target.value))}
                  >
                    {placementGroups.map(g => (
                      <option key={g.group_no} value={g.group_no}>مجموعة {g.group_no}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>إلى مجموعة رقم</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                    value={bulkToGroup}
                    onChange={e => setBulkToGroup(Number(e.target.value))}
                  >
                    {placementGroups.map(g => (
                      <option key={g.group_no} value={g.group_no}>مجموعة {g.group_no}</option>
                    ))}
                  </select>
                </div>

                <button className="btn btn-primary" style={{ height: 38 }} onClick={handleBulkAssignSupervisor}>
                  تسكين للمجموعات المحددة
                </button>
              </div>
            </div>
          )}

          {[
            { title: 'المجموعات من 1 إلى 20', min: 1, max: 20, badgeColor: '#3b82f6' },
            { title: 'المجموعات من 21 إلى 40', min: 21, max: 40, badgeColor: '#10b981' },
          ].map(shift => {
            const shiftGroups = placementGroups.filter(g => {
              if (g.group_no < shift.min || g.group_no > shift.max) return false;
              if (myGroupNumbers !== null && !myGroupNumbers.has(Number(g.group_no))) return false;
              return true;
            });
            return (
              <div key={shift.title} className="box-card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} style={{ color: shift.badgeColor }} /> {shift.title}
                  </h3>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    سعة كل مجموعة: {PLACEMENT_GROUP_CAPACITY} دارساً يومياً (كل مجموعة لها محفظ ومنسق، ويشرف المشرف العلمي والتقني على عدد من المجموعات)
                  </span>
                </div>

                <div className="table-wrapper">
                  <table className="management-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center' }}>رقم المجموعة</th>
                        <th style={{ textAlign: 'center' }}>توقيت المجموعة (من - إلى)</th>
                        <th style={{ textAlign: 'center' }}>المشرف العلمي</th>
                        <th style={{ textAlign: 'center' }}>المشرف التقني</th>
                        <th style={{ textAlign: 'center' }}>المحفظ (اسم الحلقة/المجموعة)</th>
                        <th style={{ textAlign: 'center' }}>المنسق المشرف</th>
                        <th style={{ textAlign: 'center' }}>رابط تيمز (Teams)</th>
                        <th style={{ textAlign: 'center' }}>المسكنون حالياً</th>
                        <th style={{ textAlign: 'center' }}>عرض / طباعة الكشف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftGroups.map(g => {
                        const groupApps = platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no));
                        const count = groupApps.length;
                        const groupDatesMap = new Map();
                        groupApps.forEach(a => {
                          const d = normalizeExamDate(a.exam_date);
                          if (d) groupDatesMap.set(d, (groupDatesMap.get(d) || 0) + 1);
                        });
                        const groupDates = Array.from(groupDatesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                        const rowSelectedDate = groupRowDateMap[g.group_no] || 'ALL';
                        return (
                          <tr key={g.id}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              مجموعة {g.group_no}
                              {g.mohfez && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>حلقة الشيخ/ {g.mohfez}</div>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isAdminOrSupervisor ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <input
                                    type="time"
                                    className="form-input"
                                    style={{ padding: '4px 6px', fontSize: 12, width: 105 }}
                                    title="من الساعة"
                                    value={!isLegacyDefaultGroupShift(g) ? (normalizeExamTime(g.time_start) || '') : ''}
                                    onChange={e => handleGroupUpdate(g, 'time_start', e.target.value)}
                                  />
                                  <span style={{ fontSize: 12 }}>إلى</span>
                                  <input
                                    type="time"
                                    className="form-input"
                                    style={{ padding: '4px 6px', fontSize: 12, width: 105 }}
                                    title="إلى الساعة"
                                    value={!isLegacyDefaultGroupShift(g) ? (normalizeExamTime(g.time_end) || '') : ''}
                                    onChange={e => handleGroupUpdate(g, 'time_end', e.target.value)}
                                  />
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 'bold', color: shift.badgeColor }}>
                                  {getGroupTimeLabel(g, groupApps) || 'لم يحدد بعد'}
                                </span>
                              )}
                            </td>
                            <td style={{ minWidth: 185 }}>
                              {isAdminOrSupervisor ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: 13 }}
                                  value={g.scientific_supervisor || ''}
                                  onChange={e => handleGroupUpdate(g, 'scientific_supervisor', e.target.value)}
                                >
                                  <option value="">--- مشرف علمي (من المحفظين) ---</option>
                                  {scientificSupervisorsList.map(s => (
                                    <option key={s.id} value={s.name}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div style={{ textAlign: 'center' }}>{g.scientific_supervisor || 'غير مسكن بعد'}</div>
                              )}
                            </td>
                            <td style={{ minWidth: 185 }}>
                              {isAdminOrSupervisor ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: 13 }}
                                  value={g.technical_supervisor || ''}
                                  onChange={e => handleGroupUpdate(g, 'technical_supervisor', e.target.value)}
                                >
                                  <option value="">--- مشرف تقني (من المنسقين) ---</option>
                                  {technicalSupervisorsList.map(s => (
                                    <option key={s.id} value={s.name}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div style={{ textAlign: 'center' }}>{g.technical_supervisor || 'غير مسكن بعد'}</div>
                              )}
                            </td>
                            <td style={{ minWidth: 200 }}>
                              {(isAdminOrSupervisor || isCoordinator) ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: 13 }}
                                  value={g.mohfez || ''}
                                  onChange={e => handleGroupUpdate(g, 'mohfez', e.target.value)}
                                >
                                  <option value="">--- تسكين محفظ لاحقاً ---</option>
                                  {platformMohfezs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                              ) : (
                                <div style={{ textAlign: 'center' }}>{g.mohfez || 'غير مسكن بعد'}</div>
                              )}
                            </td>
                            <td style={{ minWidth: 200 }}>
                              {isAdminOrSupervisor ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: 13 }}
                                  value={g.coordinator || ''}
                                  onChange={e => handleGroupUpdate(g, 'coordinator', e.target.value)}
                                >
                                  <option value="">--- تسكين منسق لاحقاً ---</option>
                                  {platformCoordinators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                              ) : (
                                <div style={{ textAlign: 'center' }}>{g.coordinator || 'غير مسكن بعد'}</div>
                              )}
                            </td>
                            <td style={{ minWidth: 220 }}>
                              {isAdminOrSupervisor ? (
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '5px 8px', fontSize: 12 }}
                                  placeholder="رابط اجتماع Teams..."
                                  value={g.teams_link || ''}
                                  onChange={e => handleGroupUpdate(g, 'teams_link', e.target.value)}
                                  dir="ltr"
                                />
                              ) : g.teams_link ? (
                                <a href={g.teams_link} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>
                                  دخول الرابط
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {count} / {PLACEMENT_GROUP_CAPACITY}
                            </td>
                            <td style={{ textAlign: 'center', minWidth: 280 }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                  className="form-select"
                                  style={{ padding: '4px 8px', fontSize: 12, width: 'auto', minWidth: 145 }}
                                  value={rowSelectedDate}
                                  onChange={e => setGroupRowDateMap(prev => ({ ...prev, [g.group_no]: e.target.value }))}
                                  title="اختر اليوم أو المجموعة كاملة للطباعة"
                                >
                                  <option value="ALL">المجموعة كاملة ({count})</option>
                                  {groupDates.length > 1 && (
                                    <option value="SPLIT_BY_DATE">كشف مستقل لكل يوم</option>
                                  )}
                                  {groupDates.map(([d, c]) => (
                                    <option key={d} value={d}>
                                      يوم {d} ({c})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-gold-outline"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => handlePrintGroupSheet(g)}
                                  title="طباعة كشف اختبار المجموعة حسب الاختيار"
                                >
                                  <Printer size={14} /> طباعة
                                </button>
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => handleExportGroupSheetExcel(g)}
                                  title="تصدير كشف اختبار المجموعة إكسيل حسب الاختيار"
                                >
                                  <Download size={14} /> إكسيل
                                </button>
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => {
                                    setFilterGroupNo(String(g.group_no));
                                    if (rowSelectedDate && rowSelectedDate !== 'ALL' && rowSelectedDate !== 'SPLIT_BY_DATE') {
                                      setFilterExamDate(rowSelectedDate);
                                    } else {
                                      setFilterExamDate('');
                                    }
                                    setActiveTab('applicants');
                                  }}
                                >
                                  عرض الدارسين
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────── التبويب الثالث: المجموعات المتوافقة لدمجها في الحلقات الأصلية ───────── */}
      {activeTab === 'compatible' && isAdminOrSupervisor && (
        <div className="box-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>المجموعات المتوافقة (حسب الرواق والمستوى والسورة والأيام والتوقيت)</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            يتم تجميع الدارسين الذين تم تحديد مستواهم وتتشابه اختياراتهم تلقائياً هنا لدمج كل مجموعة متوافقة مع بعضها في الحلقات الأصلية.
          </p>

          <div className="table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>م</th>
                  <th style={{ textAlign: 'center' }}>الرواق</th>
                  <th style={{ textAlign: 'center' }}>المستوى</th>
                  <th style={{ textAlign: 'center' }}>السورة المتوقف عندها</th>
                  <th style={{ textAlign: 'center' }}>الأيام المناسبة</th>
                  <th style={{ textAlign: 'center' }}>التوقيت المناسب</th>
                  <th style={{ textAlign: 'center' }}>عدد الدارسين المتوافقين</th>
                  <th style={{ textAlign: 'center' }}>تصدير</th>
                </tr>
              </thead>
              <tbody>
                {compatibleBuckets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      لا توجد مجموعات مصنفة بعد — ستظهر تلقائياً بمجرد رفع وتحديد مستويات الدارسين.
                    </td>
                  </tr>
                ) : (
                  compatibleBuckets.map((b, idx) => (
                    <tr key={b.key}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{b.rowaq}</td>
                      <td style={{ textAlign: 'center' }}>{b.level}</td>
                      <td style={{ textAlign: 'center' }}>{b.stopped_surah}</td>
                      <td style={{ textAlign: 'center' }}>{b.preferred_days}</td>
                      <td style={{ textAlign: 'center' }}>{b.preferred_time}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{b.members.length} دارس</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            const rows = b.members.map(m => ({
                              'الاسم': m.name,
                              'الرقم القومي أو جواز السفر': m.national_id || m.passport_no || '',
                              'الرواق': b.rowaq,
                              'المستوى وفق الاختبار': m.tested_level || b.level || '',
                              'السورة المتوقف عندها': b.stopped_surah,
                              'الأيام المناسبة': b.preferred_days,
                              'التوقيت المناسب': b.preferred_time,
                            }));
                            exportToXLSX(rows, `مجموعة_متوافقة_${b.rowaq}_${b.level}`, 'مجموعة متوافقة');
                          }}
                        >
                          <Download size={14} /> تصدير المجموعة
                        </button>
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

export default PlatformApplicantsList;
