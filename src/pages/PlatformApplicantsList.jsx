import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, Trash2, Edit, Video,
  Users, Layers, GitMerge, Clock, Calendar, Printer, RefreshCw,
  CheckCircle2, AlertCircle, Eye, Copy, Filter, X, Check
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
  mapApplicantRowaqToOriginal,
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
    platformSessions = [],
    addPlatformStudent,
    bulkImportPlatformStudents,
  } = useAppData();

  const importRef = useRef(null);
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const role = currentUser?.role || '';
  const isAdmin = (role === 'admin' || role === 'platform_admin') && !!currentUser;
  const isMohfez = role === 'platform_mohfez' || role === 'mohfez';
  const isSupervisor = role === 'platform_supervisor';
  const isCoordinator = useMemo(() => {
    if (role === 'platform_coordinator' || role === 'coordinator') return true;
    const uName = normalizeArabic(currentUser?.name || '');
    if (!uName) return false;
    return placementGroups.some(g =>
      (g.coordinator && normalizeArabic(g.coordinator) === uName) ||
      (g.technical_supervisor && normalizeArabic(g.technical_supervisor) === uName)
    );
  }, [role, currentUser, placementGroups]);
  const isAdminOrSupervisor = ['admin', 'platform_admin', 'platform_supervisor'].includes(role);

  const [activeTab, setActiveTab] = useState('applicants'); // applicants | groups | compatible
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isSyncingTeams, setIsSyncingTeams] = useState(false);

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
  const [printExamStage, setPrintExamStage] = useState('ALL'); // 'ALL' | 'BEFORE' | 'AFTER'
  const [printCustomDate, setPrintCustomDate] = useState('');
  const [groupRowDateMap, setGroupRowDateMap] = useState({}); // { [group_no]: 'ALL' | 'SPLIT_BY_DATE' | 'YYYY-MM-DD' }

  // خيارات المجموعات المتوافقة (5 دارسين لكل مجموعة للدمج في الحلقات الأصلية)
  const [compatStatusFilter, setCompatStatusFilter] = useState('all'); // 'all' | 'complete' | 'pending'
  const [compatRowaqFilter, setCompatRowaqFilter] = useState('');
  const [compatLevelFilter, setCompatLevelFilter] = useState('');
  const [compatDaysFilter, setCompatDaysFilter] = useState('');
  const [compatTimeFilter, setCompatTimeFilter] = useState('');
  const [compatSearch, setCompatSearch] = useState('');
  const [compatPage, setCompatPage] = useState(1);
  const [selectedCompatGroup, setSelectedCompatGroup] = useState(null);
  const [mergeModalGroup, setMergeModalGroup] = useState(null);
  const [mergeTargetSessionNo, setMergeTargetSessionNo] = useState('');
  const [mergeIsSubmitting, setMergeIsSubmitting] = useState(false);
  const [copiedGroupDisplayNo, setCopiedGroupDisplayNo] = useState(null);
  const compatPageSize = 25;

  // تجميع كافة الأسماء البديلة للمستخدم الحالي (الاسم المسجل، والاسم في جدول المشرفين/المنسقين/المحفظين عبر الرقم القومي أو اسم المستخدم)
  const currentPossibleNames = useMemo(() => {
    const set = new Set();
    if (currentUser?.name) {
      const n = normalizeArabic(currentUser.name);
      if (n) set.add(n);
    }
    const cNid = String(currentUser?.national_id || currentUser?.username || '').trim();
    if (cNid) {
      const matchSup = platformSupervisors.find(s => String(s.national_id || s.username || '').trim() === cNid);
      if (matchSup?.name) {
        const n = normalizeArabic(matchSup.name);
        if (n) set.add(n);
      }
      const matchCoord = platformCoordinators.find(c => String(c.national_id || c.username || '').trim() === cNid);
      if (matchCoord?.name) {
        const n = normalizeArabic(matchCoord.name);
        if (n) set.add(n);
      }
      const matchMohfez = platformMohfezs.find(m => String(m.national_id || m.username || '').trim() === cNid);
      if (matchMohfez?.name) {
        const n = normalizeArabic(matchMohfez.name);
        if (n) set.add(n);
      }
    }
    return Array.from(set);
  }, [currentUser, platformSupervisors, platformCoordinators, platformMohfezs]);

  const matchesCurrentPerson = (nameField) => {
    if (!nameField) return false;
    const norm = normalizeArabic(nameField);
    for (const p of currentPossibleNames) {
      if (norm === p || norm.includes(p) || p.includes(norm)) return true;
    }
    return false;
  };

  // تحديد المجموعات التابعة للمحفظ أو المنسق أو المشرف الحالي (المدير العام فقط يرى كل شيء)
  const myGroupNumbers = useMemo(() => {
    if (isAdmin) return null; // الإدارة فقط ترى جميع المجموعات
    const nums = new Set();
    placementGroups.forEach(g => {
      if (isSupervisor && (
        matchesCurrentPerson(g.scientific_supervisor) ||
        matchesCurrentPerson(g.technical_supervisor) ||
        matchesCurrentPerson(g.supervisor)
      )) {
        nums.add(Number(g.group_no));
      }
      if (isCoordinator && (
        matchesCurrentPerson(g.coordinator) ||
        matchesCurrentPerson(g.technical_supervisor)
      )) {
        nums.add(Number(g.group_no));
      }
      if (isMohfez && (
        matchesCurrentPerson(g.mohfez) ||
        matchesCurrentPerson(g.scientific_supervisor)
      )) {
        nums.add(Number(g.group_no));
      }
    });
    return nums;
  }, [isAdmin, isSupervisor, isCoordinator, isMohfez, placementGroups, currentPossibleNames]);

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

  // تصفية المتقدمين حسب صلاحية ونطاق المستخدم (أدمن يرى الجميع، مشرف/منسق/محفظ يرى مجموعاته فقط) + الفلاتر
  const filtered = useMemo(() => {
    return platformApplicants.filter(a => {
      if (myGroupNumbers !== null) {
        const gNo = Number(a.group_no);
        const inMyGroup = gNo && myGroupNumbers.has(gNo);
        const directMatch = (isMohfez && (matchesCurrentPerson(a.mohfez) || matchesCurrentPerson(a.scientific_supervisor))) ||
                            (isCoordinator && (matchesCurrentPerson(a.coordinator) || matchesCurrentPerson(a.technical_supervisor))) ||
                            (isSupervisor && (matchesCurrentPerson(a.scientific_supervisor) || matchesCurrentPerson(a.technical_supervisor) || matchesCurrentPerson(a.supervisor)));

        if (!inMyGroup && !directMatch) return false;
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
        patch.teams_link = grp.teams_link || '';
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

  // فحص صلاحية إدارة مجموعة معينة (الإدارة، المشرف التقني/العلمي للمجموعة، أو منسق المجموعة)
  const canManageGroup = (group, field = null) => {
    if (!group) return false;
    if (isAdmin) return true;
    if (currentPossibleNames.length === 0) return false;

    const isGroupTechSup = matchesCurrentPerson(group.technical_supervisor);
    const isGroupCoord = matchesCurrentPerson(group.coordinator);
    const isGroupSciSup = matchesCurrentPerson(group.scientific_supervisor);

    // المشرف التقني للمجموعة له صلاحية كاملة على مجموعاته الخاصة:
    // تسكين المنسق، رابط تيمز، تسكين المحفظ، تعديل توقيت المجموعة
    if (isGroupTechSup) {
      if (!field || ['coordinator', 'teams_link', 'mohfez', 'time_start', 'time_end'].includes(field)) {
        return true;
      }
    }

    // المشرف العلمي للمجموعة له صلاحية على تعديل التوقيت ورابط تيمز
    if (isGroupSciSup) {
      if (!field || ['teams_link', 'time_start', 'time_end'].includes(field)) {
        return true;
      }
    }

    // منسق المجموعة له صلاحية إدخال رابط تيمز وتوقيت مجموعته
    if (isGroupCoord) {
      if (!field || ['teams_link', 'time_start', 'time_end'].includes(field)) {
        return true;
      }
    }

    return false;
  };

  // تحديث بيانات إحدى المجموعات الـ 40 + عكسها على المتقدمين المسكنين فيها
  const handleGroupUpdate = (group, field, value) => {
    // التحقق من الصلاحية: الإدارة أو المشرف التقني للمجموعة أو منسق المجموعة
    if (!canManageGroup(group, field)) return;
    updatePlacementGroup(group.id, { [field]: value });
    if (field === 'teams_link') {
      const gNo = Number(group.group_no);
      if (gNo) {
        setPlatformApplicants(prev => {
          const next = prev.map(a => Number(a.group_no) === gNo ? { ...a, teams_link: value } : a);
          localStorage.setItem('platformApplicants', JSON.stringify(next));
          return next;
        });
      }
    }
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

    let baseApplicants = effectiveGroupNo
      ? platformApplicants.filter(a => String(a.group_no || '') === String(effectiveGroupNo))
      : filtered;

    if (printExamStage === 'AFTER') {
      const testedApplicants = baseApplicants.filter(a => a.tested_level || a.status === 'تم تحديد المستوى');
      if (testedApplicants.length > 0) {
        baseApplicants = testedApplicants;
      }
    }

    return buildExamSheetsByGroupAndCoordinator(baseApplicants, placementGroups, {
      targetGroupNo: effectiveGroupNo,
      targetCoordinator: filterCoordinator,
      targetDate: resolvedDate,
      splitByDate: printDateMode === 'SPLIT_BY_DATE',
      padToCapacity: Boolean(effectiveGroupNo),
      examStage: printExamStage,
      blankResults: printExamStage === 'BEFORE',
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

  // تصفير روابط الدارسين وتعميم روابط تيمز الخاصة بالمجموعات على جميع الدارسين
  const handleSyncGroupTeamsLinks = async () => {
    if (!window.confirm(
      'هل تريد بالتأكيد تصفير روابط تيمز الحالية للدارسين، وتعميم روابط تيمز الخاصة بالمجموعات (من 1 إلى 40) على جميع الدارسين التابعين لكل مجموعة؟\n\n' +
      '• سيتم مسح أي روابط فردية قديمة لدى الدارسين.\n' +
      '• سيتم تعميم رابط كل مجموعة مباشرة على كافة الدارسين المسكنين في تلك المجموعة.'
    )) return;

    setIsSyncingTeams(true);
    try {
      const res = await platformApplicantsAPI.syncGroupTeamsLinks(placementGroups);

      // تحديث فوري للحالة والذاكرة المحلية
      const groupMap = new Map();
      placementGroups.forEach(g => {
        const gNo = Number(g.group_no);
        if (gNo && g.teams_link) groupMap.set(gNo, g.teams_link.trim());
      });

      const nextApps = platformApplicants.map(a => {
        const gNo = Number(a.group_no);
        return {
          ...a,
          teams_link: groupMap.get(gNo) || ''
        };
      });

      if (typeof setPlatformApplicants === 'function') {
        setPlatformApplicants(nextApps);
      }
      localStorage.setItem('platformApplicants', JSON.stringify(nextApps));

      alert(
        `تمت العملية بنجاح في قاعدة البيانات!\n\n` +
        `• تم تصفير روابط الدارسين الفردية السابقة.\n` +
        `• عدد المجموعات المعممة روابطها: ${res.groupsCount || groupMap.size} مجموعة\n` +
        `• إجمالي الدارسين الذين تم تعميم الرابط لهم: ${res.totalAssigned || nextApps.filter(a => a.teams_link).length} دارساً`
      );

      if (typeof refreshPlatformApplicants === 'function') {
        await refreshPlatformApplicants();
      }
    } catch (err) {
      alert('فشل تعميم روابط المجموعات: ' + (err.message || err));
    } finally {
      setIsSyncingTeams(false);
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
      // إعادة المحاولة تلقائياً لامتصاص وقت الإيقاظ المؤقت (Cold Start)
      try {
        await new Promise(r => setTimeout(r, 1200));
        if (typeof refreshPlatformApplicants === 'function') {
          await refreshPlatformApplicants();
        }
        alert('تم تحديث البيانات من قاعدة البيانات بنجاح!');
        return;
      } catch (retryErr) {
        alert('فشل تحديث البيانات من السيرفر: ' + (retryErr.message || err.message));
      }
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

  // تجميع المتقدمين المتوافقين في (نوع الرواق + المستوى المحدد + السورة المتوقف عندها + الأيام المناسبة + التوقيت المختار)
  // وتقسيم كل فئة متطابقة إلى مجموعات سعة كل منها 5 دارسين متوافقين بالضبط لدمجهم في الحلقات الأصلية
  const {
    allCompatibleGroups,
    completeGroups,
    pendingGroups,
    completeGroupsCount,
    pendingGroupsCount,
    totalGroupedApplicants,
    availableCompatLevels,
  } = useMemo(() => {
    const bucketsMap = {};

    platformApplicants.forEach(a => {
      const r = normalizeApplicantRowaq(a.rowaq, a.gender) || a.rowaq || '';
      const effLevel = (a.tested_level || a.applied_level || a.level || '').trim();
      if (!r || !effLevel) return;

      const surah = (a.stopped_surah || 'غير محدد').trim();
      const prefDays = normalizePreferredDays(a.preferred_days || '') || 'غير محدد';
      const prefTime = (a.preferred_time || 'غير محدد').trim();

      // معايير التوافق التام للدمج: نوع الرواق + المستوى + السورة + الأيام المناسبة + التوقيت
      const bucketKey = `${r}__${effLevel}__${surah}__${prefDays}__${prefTime}`;

      if (!bucketsMap[bucketKey]) {
        bucketsMap[bucketKey] = {
          bucketKey,
          rowaq: r,
          level: effLevel,
          stopped_surah: surah,
          preferred_days: prefDays,
          preferred_time: prefTime,
          applicants: [],
        };
      }
      bucketsMap[bucketKey].applicants.push(a);
    });

    const groups = [];
    const levelsSet = new Set();
    let compCount = 0;
    let pendCount = 0;
    let totalGrouped = 0;

    // الفرز: الفئات الأكثر عدداً تأتي أولاً
    const sortedBuckets = Object.values(bucketsMap).sort((a, b) => b.applicants.length - a.applicants.length);

    sortedBuckets.forEach((bucket, bIdx) => {
      levelsSet.add(bucket.level);
      const total = bucket.applicants.length;
      let partIdx = 1;

      // تقسيم كل فئة مطابقة إلى مجموعات من 5 دارسين متوافقين
      for (let i = 0; i < total; i += 5) {
        const chunk = bucket.applicants.slice(i, i + 5);
        const isComplete = chunk.length === 5;
        if (isComplete) compCount++;
        else pendCount++;
        totalGrouped += chunk.length;

        groups.push({
          id: `${bucket.bucketKey}_part_${partIdx}`,
          rowaq: bucket.rowaq,
          level: bucket.level,
          stopped_surah: bucket.stopped_surah,
          preferred_days: bucket.preferred_days,
          preferred_time: bucket.preferred_time,
          members: chunk,
          count: chunk.length,
          isComplete,
          bucketIndex: bIdx + 1,
          partIndex: partIdx++,
        });
      }
    });

    // ترتيب المجموعات: المكتملة أولاً (5/5) ثم قيد الاكتمال (<5)
    groups.sort((a, b) => {
      if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
      if (a.rowaq !== b.rowaq) return a.rowaq.localeCompare(b.rowaq, 'ar');
      if (a.level !== b.level) return a.level.localeCompare(b.level, 'ar');
      return b.count - a.count;
    });

    // رقم مسلسل نهائي متتابع لكل مجموعة
    groups.forEach((g, idx) => {
      g.displayNo = idx + 1;
    });

    const completeList = groups.filter(g => g.isComplete);
    const pendingList = groups.filter(g => !g.isComplete);

    return {
      allCompatibleGroups: groups,
      completeGroups: completeList,
      pendingGroups: pendingList,
      completeGroupsCount: compCount,
      pendingGroupsCount: pendCount,
      totalGroupedApplicants: totalGrouped,
      availableCompatLevels: Array.from(levelsSet).sort(),
    };
  }, [platformApplicants]);

  // تصفية المجموعات المتوافقة
  const filteredCompatibleGroups = useMemo(() => {
    return allCompatibleGroups.filter(g => {
      if (compatStatusFilter === 'complete' && !g.isComplete) return false;
      if (compatStatusFilter === 'pending' && g.isComplete) return false;
      if (compatRowaqFilter && g.rowaq !== compatRowaqFilter) return false;
      if (compatLevelFilter && g.level !== compatLevelFilter) return false;
      if (compatDaysFilter && g.preferred_days !== compatDaysFilter) return false;
      if (compatTimeFilter && g.preferred_time !== compatTimeFilter) return false;
      if (compatSearch) {
        const q = normalizeArabic(compatSearch.trim());
        const matchSurah = normalizeArabic(g.stopped_surah).includes(q);
        const matchDays = normalizeArabic(g.preferred_days).includes(q);
        const matchTime = normalizeArabic(g.preferred_time).includes(q);
        const matchNo = String(g.displayNo).includes(q);
        const matchMember = g.members.some(m =>
          normalizeArabic(m.name || '').includes(q) ||
          String(m.national_id || m.passport_no || '').includes(q) ||
          String(m.phone || '').includes(q)
        );
        if (!matchSurah && !matchDays && !matchTime && !matchNo && !matchMember) return false;
      }
      return true;
    });
  }, [allCompatibleGroups, compatStatusFilter, compatRowaqFilter, compatLevelFilter, compatDaysFilter, compatTimeFilter, compatSearch]);

  const totalCompatPages = Math.max(1, Math.ceil(filteredCompatibleGroups.length / compatPageSize));
  const paginatedCompatibleGroups = useMemo(() => {
    const start = (compatPage - 1) * compatPageSize;
    return filteredCompatibleGroups.slice(start, start + compatPageSize);
  }, [filteredCompatibleGroups, compatPage, compatPageSize]);

  // تصدير كشف مجموعة واحدة (5 دارسين)
  const exportSingleCompatibleGroup = (group) => {
    const rows = group.members.map((m, idx) => ({
      'م': idx + 1,
      'رقم المجموعة المتوافقة': `مجموعة متوافقة ${group.displayNo}`,
      'حالة المجموعة': group.isComplete ? 'مكتملة (5 دارسين)' : `قيد الاكتمال (${group.count}/5)`,
      'اسم الدارس': m.name || '',
      'الرقم القومي / جواز السفر': m.national_id || m.passport_no || '',
      'رقم التليفون': m.phone || '',
      'المحافظة': m.governorate || '',
      'الرواق': group.rowaq,
      'المستوى': m.tested_level || group.level,
      'السورة المتوقف عندها': group.stopped_surah,
      'الأيام المناسبة للمجموعة': group.preferred_days,
      'التوقيت المختار للمجموعة': group.preferred_time,
      'الأيام المسجلة للدارس': m.preferred_days || '',
    }));
    exportToXLSX(rows, `مجموعة_متوافقة_${group.displayNo}_(5_دارسين)`, `مجموعة ${group.displayNo}`);
  };

  // تصدير جميع المجموعات المكتملة (5/5)
  const exportAllCompleteGroups = () => {
    if (completeGroups.length === 0) {
      alert('لا توجد مجموعات مكتملة (5/5 دارسين) حالياً للتصدير');
      return;
    }
    const rows = [];
    completeGroups.forEach(g => {
      g.members.forEach((m, idx) => {
        rows.push({
          'رقم المجموعة المتوافقة (5 دارسين)': `مجموعة ${g.displayNo}`,
          'م داخل المجموعة': idx + 1,
          'اسم الدارس': m.name || '',
          'الرقم القومي / جواز السفر': m.national_id || m.passport_no || '',
          'رقم التليفون': m.phone || '',
          'المحافظة': m.governorate || '',
          'الرواق': g.rowaq,
          'المستوى المحدد': m.tested_level || g.level,
          'السورة المتوقف عندها': g.stopped_surah,
          'الأيام المناسبة للمجموعة': g.preferred_days,
          'التوقيت المختار للمجموعة': g.preferred_time,
          'الأيام المسجلة للدارس': m.preferred_days || '',
        });
      });
    });
    exportToXLSX(rows, `المجموعات_المكتملة_${completeGroups.length}_مجموعة_(5_دارسين)`, 'المجموعات المكتملة 5 دارسين');
  };

  // تصدير كافة المجموعات (المكتملة وقيد الاكتمال)
  const exportAllCompatibleGroups = () => {
    if (allCompatibleGroups.length === 0) {
      alert('لا توجد مجموعات متوافقة للتصدير');
      return;
    }
    const rows = [];
    allCompatibleGroups.forEach(g => {
      g.members.forEach((m, idx) => {
        rows.push({
          'رقم المجموعة المتوافقة': `مجموعة ${g.displayNo}`,
          'حالة الاكتمال': g.isComplete ? 'مكتملة (5/5)' : `قيد الاكتمال (${g.count}/5)`,
          'م داخل المجموعة': idx + 1,
          'اسم الدارس': m.name || '',
          'الرقم القومي / جواز السفر': m.national_id || m.passport_no || '',
          'رقم التليفون': m.phone || '',
          'المحافظة': m.governorate || '',
          'الرواق': g.rowaq,
          'المستوى المحدد': m.tested_level || g.level,
          'السورة المتوقف عندها': g.stopped_surah,
          'الأيام المناسبة للمجموعة': g.preferred_days,
          'التوقيت المختار للمجموعة': g.preferred_time,
          'الأيام المسجلة للدارس': m.preferred_days || '',
        });
      });
    });
    exportToXLSX(rows, `جميع_المجموعات_المتوافقة_${allCompatibleGroups.length}_مجموعة`, 'المجموعات المتوافقة');
  };

  // نسخ بيانات الدارسين للمحفظ / الواتساب
  const copyGroupRoster = (group) => {
    const lines = [
      `📋 مجموعة متوافقة رقم (${group.displayNo}) - ${group.isComplete ? 'مكتملة (5 دارسين)' : `قيد الاكتمال (${group.count}/5)`}`,
      `🔹 الرواق: ${group.rowaq}`,
      `🔹 المستوى: ${group.level}`,
      `🔹 السورة المتوقف عندها: ${group.stopped_surah}`,
      `🔹 الأيام المناسبة: ${group.preferred_days}`,
      `🔹 التوقيت المختار: ${group.preferred_time}`,
      `──────── الدارسون (${group.count}) ────────`,
    ];
    group.members.forEach((m, i) => {
      lines.push(`${i + 1}- ${m.name || 'بدون اسم'} | رقم: ${m.national_id || m.passport_no || '-'} | هاتف: ${m.phone || '-'} | الأيام: ${m.preferred_days || '-'}`);
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedGroupDisplayNo(group.displayNo);
    setTimeout(() => setCopiedGroupDisplayNo(null), 2500);
  };

  // دمج الدارسين الخمسة في حلقة أصلية
  const handleConfirmMergeSession = async () => {
    if (!mergeModalGroup) return;
    const targetSession = String(mergeTargetSessionNo || '').trim();
    if (!targetSession) {
      alert('يرجى اختيار أو إدخال رقم الحلقة الأصلية للتسكين');
      return;
    }
    try {
      setMergeIsSubmitting(true);
      const originalMeta = mapApplicantRowaqToOriginal(mergeModalGroup.rowaq);
      const newStudents = mergeModalGroup.members.map(m => ({
        name: m.name || '',
        national_id: m.national_id || m.passport_no || '',
        passport_no: m.passport_no || '',
        phone: m.phone || '',
        country: m.country || 'مصر',
        governorate: m.governorate || '',
        rowaq: originalMeta.rowaq,
        student_type: originalMeta.student_type,
        gender: m.gender || originalMeta.gender,
        level: m.tested_level || mergeModalGroup.level,
        stopped_surah: mergeModalGroup.stopped_surah,
        session_no: targetSession,
        status: 'منتظم',
        notes: `تم التسكين من المجموعات المتوافقة رقم ${mergeModalGroup.displayNo} (الأيام: ${mergeModalGroup.preferred_days} | التوقيت: ${mergeModalGroup.preferred_time})`,
      }));

      if (typeof bulkImportPlatformStudents === 'function') {
        await bulkImportPlatformStudents(newStudents);
      } else if (typeof addPlatformStudent === 'function') {
        for (const s of newStudents) {
          addPlatformStudent(s);
        }
      }

      alert(`تم بنجاح تسكين (${newStudents.length}) دارسين في الحلقة الأصلية رقم [${targetSession}]`);
      setMergeModalGroup(null);
      setMergeTargetSessionNo('');
    } catch (err) {
      console.error('Merge error:', err);
      alert('حدث خطأ أثناء دمج الدارسين: ' + err.message);
    } finally {
      setMergeIsSubmitting(false);
    }
  };

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
        {isAdmin && (
          <button
            className={`btn ${activeTab === 'compatible' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('compatible')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <GitMerge size={16} /> المجموعات المتوافقة للدمج (5 دارسين)
            <span style={{
              background: '#10b981',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 'bold',
            }}>
              {completeGroupsCount} مكتملة
            </span>
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
                  <option value="">{myGroupNumbers === null ? '--- كل المجموعات (1 - 40) ---' : '--- مجموعاتي المصرحة ---'}</option>
                  <optgroup label="المجموعات 1 - 20">
                    {placementGroups
                      .filter(g => g.group_no <= 20 && (myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no))))
                      .map(g => (
                        <option key={g.group_no} value={g.group_no}>
                          مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="المجموعات 21 - 40">
                    {placementGroups
                      .filter(g => g.group_no > 20 && (myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no))))
                      .map(g => (
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

              <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
                <label style={{ fontSize: 13 }}>حالة الكشف (قبل / بعد الاختبار)</label>
                <select
                  className="form-select"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={printExamStage}
                  onChange={e => setPrintExamStage(e.target.value)}
                >
                  <option value="ALL">كامل الكشف (البيانات المسجلة)</option>
                  <option value="BEFORE">قبل الاختبار (نموذج لجنة الامتحان - خانات النتيجة فارغة)</option>
                  <option value="AFTER">بعد الاختبار (كشف نتائج تحديد المستوى والرصد)</option>
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
              {isAdmin && (
                <Link to="/platform-applicants/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  <Plus size={16} /> إضافة متقدم
                </Link>
              )}
              {isAdmin && (
                <>
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
              {isAdmin && (
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
              )}
              {isAdmin && (
                <button
                  className="btn btn-outline"
                  onClick={handleSyncGroupTeamsLinks}
                  disabled={isSyncingTeams}
                  title="حذف روابط الدارسين الفردية وتعميم رابط كل مجموعة على كافة دارسيها"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10b981', borderColor: '#10b981' }}
                >
                  <Video size={16} />
                  {isSyncingTeams ? 'جارٍ تعميم الروابط...' : 'تعميم روابط تيمز للمجموعات'}
                </button>
              )}
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
                          {(isAdminOrSupervisor || isCoordinator) ? (
                            <select
                              className="form-select"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              value={a.group_no || ''}
                              onChange={e => handleInlineUpdate(a, 'group_no', e.target.value)}
                            >
                              <option value="">غير مسكن</option>
                              {placementGroups
                                .filter(g => myGroupNumbers === null || myGroupNumbers.has(Number(g.group_no)))
                                .map(g => (
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
                          {(isAdminOrSupervisor || isCoordinator) && (
                            <Link
                              to={`/platform-applicants/create?id=${a.id}`}
                              className="action-icon edit"
                              style={{ textDecoration: 'none', color: 'inherit' }}
                              title="تعديل بيانات الدارس ونتيجته"
                            >
                              <Edit size={16} />
                            </Link>
                          )}
                          {isAdmin && (
                            <button className="action-icon delete" title="حذف" onClick={() => deletePlatformApplicant(a.id)}>
                              <Trash2 size={16} />
                            </button>
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
              {isAdmin && (
                <button
                  className="btn btn-primary"
                  style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#059669', borderColor: '#059669' }}
                  onClick={handleSyncGroupTeamsLinks}
                  disabled={isSyncingTeams}
                  title="حذف روابط الدارسين الفردية وتعميم رابط كل مجموعة على كافة دارسيها"
                >
                  <Video size={16} /> {isSyncingTeams ? 'جارٍ التعميم...' : 'تعميم روابط تيمز على دارسي المجموعات'}
                </button>
              )}
            </div>
          </div>

          {/* أداة تسكين مشرف علمي أو مشرف تقني لعدد من المجموعات دفعة واحدة */}
          {isAdmin && (
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

              {/* أزرار تحديد سريع لكل 10 مجموعات خاصة بمشرف علمي وتقني */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>تحديد سريع لنطاق الـ 10 مجموعات:</span>
                {[
                  { label: 'المجموعات 1 إلى 10', from: 1, to: 10 },
                  { label: 'المجموعات 11 إلى 20', from: 11, to: 20 },
                  { label: 'المجموعات 21 إلى 30', from: 21, to: 30 },
                  { label: 'المجموعات 31 إلى 40', from: 31, to: 40 },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn btn-outline"
                    style={{
                      padding: '3px 10px',
                      fontSize: 12,
                      ...(bulkFromGroup === p.from && bulkToGroup === p.to ? { borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', fontWeight: 'bold' } : {})
                    }}
                    onClick={() => {
                      setBulkFromGroup(p.from);
                      setBulkToGroup(p.to);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {myGroupNumbers !== null && myGroupNumbers.size === 0 && (
            <div className="box-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20 }}>
              لا توجد مجموعات تحديد مستوى مسندة إليك حالياً.
            </div>
          )}

          {[
            { title: 'المجموعات من 1 إلى 10', min: 1, max: 10, badgeColor: '#3b82f6' },
            { title: 'المجموعات من 11 إلى 20', min: 11, max: 20, badgeColor: '#10b981' },
            { title: 'المجموعات من 21 إلى 30', min: 21, max: 30, badgeColor: '#f59e0b' },
            { title: 'المجموعات من 31 إلى 40', min: 31, max: 40, badgeColor: '#8b5cf6' },
          ].map(shift => {
            const shiftGroups = placementGroups.filter(g => {
              if (g.group_no < shift.min || g.group_no > shift.max) return false;
              if (myGroupNumbers !== null && !myGroupNumbers.has(Number(g.group_no))) return false;
              return true;
            });
            if (shiftGroups.length === 0) return null;

            const sciSups = Array.from(new Set(shiftGroups.map(g => g.scientific_supervisor).filter(Boolean)));
            const techSups = Array.from(new Set(shiftGroups.map(g => g.technical_supervisor).filter(Boolean)));
            const totalApplicantsInShift = shiftGroups.reduce((acc, g) => {
              return acc + platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no)).length;
            }, 0);

            return (
              <div key={shift.title} className="box-card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Clock size={18} style={{ color: shift.badgeColor }} /> {shift.title}
                    </h3>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        المشرف العلمي: {sciSups.length > 0 ? sciSups.join('، ') : 'غير مسكن بعد'}
                      </span>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        المشرف التقني: {techSups.length > 0 ? techSups.join('، ') : 'غير مسكن بعد'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      المسكنون في الـ 10 مجموعات: <strong style={{ color: '#fff' }}>{totalApplicantsInShift}</strong> دارس
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => {
                          setBulkFromGroup(shift.min);
                          setBulkToGroup(shift.max);
                          window.scrollTo({ top: 350, behavior: 'smooth' });
                        }}
                      >
                        تسكين مشرفي هذه الـ 10 مجموعات
                      </button>
                    )}
                  </div>
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
                              {canManageGroup(g, 'time_start') ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <input
                                    type="time"
                                    className="form-input"
                                    style={{ padding: '4px 6px', fontSize: 12, width: 105 }}
                                    title="من الساعة"
                                    value={normalizeExamTime(g.time_start) || '17:30'}
                                    onChange={e => handleGroupUpdate(g, 'time_start', e.target.value)}
                                  />
                                  <span style={{ fontSize: 12 }}>إلى</span>
                                  <input
                                    type="time"
                                    className="form-input"
                                    style={{ padding: '4px 6px', fontSize: 12, width: 105 }}
                                    title="إلى الساعة"
                                    value={normalizeExamTime(g.time_end) || '21:00'}
                                    onChange={e => handleGroupUpdate(g, 'time_end', e.target.value)}
                                  />
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 'bold', color: shift.badgeColor }}>
                                  {getGroupTimeLabel(g, groupApps) || 'من 05:30 م إلى 09:00 م'}
                                </span>
                              )}
                            </td>
                            <td style={{ minWidth: 185 }}>
                              {isAdmin ? (
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
                              {isAdmin ? (
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
                              {canManageGroup(g, 'mohfez') ? (
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
                              {canManageGroup(g, 'coordinator') ? (
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
                            <td style={{ minWidth: 230 }}>
                              {canManageGroup(g, 'teams_link') ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ padding: '5px 8px', fontSize: 12, flex: 1 }}
                                    placeholder="رابط اجتماع Teams..."
                                    value={g.teams_link || ''}
                                    onChange={e => handleGroupUpdate(g, 'teams_link', e.target.value)}
                                    dir="ltr"
                                  />
                                  {g.teams_link && (
                                    <a
                                      href={g.teams_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="فتح وتجربة الرابط"
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                        borderRadius: 4,
                                        fontSize: 12,
                                        textDecoration: 'none',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      دخول
                                    </a>
                                  )}
                                </div>
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

      {/* ───────── التبويب الثالث: المجموعات المتوافقة لدمجها في الحلقات الأصلية (5 دارسين) ───────── */}
      {activeTab === 'compatible' && isAdmin && (
        <div className="box-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitMerge size={20} style={{ color: '#10b981' }} />
                المجموعات المتوافقة للدمج في الحلقات الأصلية (5 دارسين لكل مجموعة)
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                تجميع وتوزيع الدارسين المتوافقين تماماً في: <strong>نوع الرواق</strong>، <strong>المستوى</strong>، <strong>السورة المتوقف عندها</strong>، <strong>الأيام المناسبة</strong>، و<strong>التوقيت المختار</strong> إلى مجموعات سعة كل منها (5) دارسين لتسكينهم فوراً في الحلقات الأصلية.
              </p>
            </div>

            {/* أزرار التصدير الشامل */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}
                onClick={exportAllCompleteGroups}
              >
                <Download size={15} /> تصدير جميع المجموعات المكتملة ({completeGroupsCount} مجموعة / {completeGroupsCount * 5} دارس)
              </button>
              <button
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={exportAllCompatibleGroups}
              >
                <Download size={15} /> تصدير كافة المجموعات ({allCompatibleGroups.length})
              </button>
            </div>
          </div>

          {/* بطاقات الإحصائيات الأربعة */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} style={{ color: '#10b981' }} /> مجموعات مكتملة (5 / 5)
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>
                {completeGroupsCount} <span style={{ fontSize: 13, fontWeight: 'normal' }}>مجموعة جاهزة</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={15} style={{ color: '#3b82f6' }} /> دارسون في مجموعات مكتملة
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#3b82f6' }}>
                {completeGroupsCount * 5} <span style={{ fontSize: 13, fontWeight: 'normal' }}>دارس مؤهل</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={15} style={{ color: '#f59e0b' }} /> مجموعات قيد الاكتمال (&lt; 5)
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f59e0b' }}>
                {pendingGroupsCount} <span style={{ fontSize: 13, fontWeight: 'normal' }}>مجموعة تنتظر</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={15} style={{ color: '#a855f7' }} /> إجمالي الدارسين الموزعين
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#a855f7' }}>
                {totalGroupedApplicants} <span style={{ fontSize: 13, fontWeight: 'normal' }}>دارس موزّع</span>
              </div>
            </div>
          </div>

          {/* شريط الفلاتر والبحث */}
          <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: 16, padding: 14 }}>
            {/* أزرار حالة الاكتمال */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>حالة المجموعة:</span>
              <button
                type="button"
                className={`btn ${compatStatusFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={() => { setCompatStatusFilter('all'); setCompatPage(1); }}
              >
                جميع المجموعات ({allCompatibleGroups.length})
              </button>
              <button
                type="button"
                className={`btn ${compatStatusFilter === 'complete' ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  ...(compatStatusFilter === 'complete' ? { background: '#10b981', borderColor: '#10b981' } : {})
                }}
                onClick={() => { setCompatStatusFilter('complete'); setCompatPage(1); }}
              >
                المكتملة فقط (5/5) ({completeGroupsCount})
              </button>
              <button
                type="button"
                className={`btn ${compatStatusFilter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  ...(compatStatusFilter === 'pending' ? { background: '#f59e0b', borderColor: '#f59e0b' } : {})
                }}
                onClick={() => { setCompatStatusFilter('pending'); setCompatPage(1); }}
              >
                قيد الاكتمال (&lt; 5) ({pendingGroupsCount})
              </button>
            </div>

            {/* صف الفلاتر التفصيلية */}
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              <div className="form-group">
                <label style={{ fontSize: 12, marginBottom: 4 }}>نوع الرواق:</label>
                <select
                  value={compatRowaqFilter}
                  onChange={e => { setCompatRowaqFilter(e.target.value); setCompatPage(1); }}
                  className="form-control"
                  style={{ fontSize: 13 }}
                >
                  <option value="">-- جميع الأروقة --</option>
                  <option value="رواق القرآن الكريم ( أطفال )">رواق القرآن الكريم ( أطفال )</option>
                  <option value="رواق القرآن الكريم كبار ( رجال )">رواق القرآن الكريم كبار ( رجال )</option>
                  <option value="رواق القرآن الكريم كبار ( سيدات )">رواق القرآن الكريم كبار ( سيدات )</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, marginBottom: 4 }}>المستوى:</label>
                <select
                  value={compatLevelFilter}
                  onChange={e => { setCompatLevelFilter(e.target.value); setCompatPage(1); }}
                  className="form-control"
                  style={{ fontSize: 13 }}
                >
                  <option value="">-- جميع المستويات --</option>
                  {availableCompatLevels.map(lvl => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, marginBottom: 4 }}>الأيام المناسبة:</label>
                <select
                  value={compatDaysFilter}
                  onChange={e => { setCompatDaysFilter(e.target.value); setCompatPage(1); }}
                  className="form-control"
                  style={{ fontSize: 13 }}
                >
                  <option value="">-- جميع الأيام --</option>
                  {PREFERRED_DAYS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, marginBottom: 4 }}>التوقيت المختار:</label>
                <select
                  value={compatTimeFilter}
                  onChange={e => { setCompatTimeFilter(e.target.value); setCompatPage(1); }}
                  className="form-control"
                  style={{ fontSize: 13 }}
                >
                  <option value="">-- جميع التوقيتات --</option>
                  {PREFERRED_TIME_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1.5 }}>
                <label style={{ fontSize: 12, marginBottom: 4 }}>بحث (اسم، رقم قومي، سورة):</label>
                <input
                  type="text"
                  value={compatSearch}
                  onChange={e => { setCompatSearch(e.target.value); setCompatPage(1); }}
                  placeholder="ابحث بالاسم أو السورة أو الأيام أو التوقيت..."
                  className="form-control"
                  style={{ fontSize: 13 }}
                />
              </div>

              {(compatRowaqFilter || compatLevelFilter || compatDaysFilter || compatTimeFilter || compatSearch || compatStatusFilter !== 'all') && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: 12, height: 38 }}
                    onClick={() => {
                      setCompatRowaqFilter('');
                      setCompatLevelFilter('');
                      setCompatDaysFilter('');
                      setCompatTimeFilter('');
                      setCompatSearch('');
                      setCompatStatusFilter('all');
                      setCompatPage(1);
                    }}
                  >
                    إعادة تعيين الفلاتر
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* جدول المجموعات المتوافقة (5 دارسين لكل مجموعة) */}
          <div className="table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: 60 }}>م</th>
                  <th style={{ textAlign: 'center', minWidth: 140 }}>رقم المجموعة</th>
                  <th style={{ textAlign: 'center' }}>الرواق</th>
                  <th style={{ textAlign: 'center' }}>المستوى المحدد</th>
                  <th style={{ textAlign: 'center' }}>السورة المتوقف عندها</th>
                  <th style={{ textAlign: 'center' }}>الأيام المناسبة</th>
                  <th style={{ textAlign: 'center' }}>التوقيت المختار</th>
                  <th style={{ textAlign: 'center', width: 130 }}>حالة الاكتمال</th>
                  <th style={{ textAlign: 'center', minWidth: 260 }}>أعضاء المجموعة (الـ 5 دارسين)</th>
                  <th style={{ textAlign: 'center', minWidth: 210 }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompatibleGroups.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      لا توجد مجموعات مطابقة للفلاتر المحددة حالياً.
                    </td>
                  </tr>
                ) : (
                  paginatedCompatibleGroups.map((g) => (
                    <tr key={g.id}>
                      <td style={{ textAlign: 'center' }}>{g.displayNo}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        مجموعة متوافقة {g.displayNo}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 12,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: g.rowaq.includes('أطفال') ? 'rgba(59, 130, 246, 0.15)' : g.rowaq.includes('سيدات') ? 'rgba(236, 72, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: g.rowaq.includes('أطفال') ? '#60a5fa' : g.rowaq.includes('سيدات') ? '#f472b6' : '#34d399',
                          fontWeight: 500,
                        }}>
                          {g.rowaq}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 500 }}>{g.level}</td>
                      <td style={{ textAlign: 'center' }}>{g.stopped_surah}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 500 }}>
                          {g.preferred_days}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--accent, #e5a93c)', fontWeight: 500 }}>
                          {g.preferred_time}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {g.isComplete ? (
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            padding: '4px 10px',
                            borderRadius: 16,
                            fontSize: 12,
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}>
                            <CheckCircle2 size={13} /> مكتملة (5 / 5)
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.18)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            padding: '4px 10px',
                            borderRadius: 16,
                            fontSize: 12,
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}>
                            <AlertCircle size={13} /> قيد الاكتمال ({g.count} / 5)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {g.members.map((m, mIdx) => (
                            <div
                              key={m.id || m.national_id || mIdx}
                              style={{
                                fontSize: 12,
                                display: 'flex',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              <span style={{ fontWeight: 500 }}>{mIdx + 1}. {m.name || 'بدون اسم'}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }} dir="ltr">{m.phone || ''}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setSelectedCompatGroup(g)}
                            title="عرض تفاصيل الدارسين الخمسة"
                          >
                            <Eye size={13} /> التفاصيل
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => exportSingleCompatibleGroup(g)}
                            title="تصدير كشف هذه المجموعة إكسيل"
                          >
                            <Download size={13} /> إكسيل
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => copyGroupRoster(g)}
                            title="نسخ بيانات الدارسين للواتساب أو تيمز"
                          >
                            {copiedGroupDisplayNo === g.displayNo ? (
                              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Check size={13} /> تم النسخ
                              </span>
                            ) : (
                              <>
                                <Copy size={13} /> نسخ
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              background: '#3b82f6',
                              borderColor: '#3b82f6',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            onClick={() => { setMergeModalGroup(g); setMergeTargetSessionNo(''); }}
                            title="تسكين ودمج الدارسين في حلقة أصلية"
                          >
                            <GitMerge size={13} /> دمج بالحلقة
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* الترقيم والتنقل بين الصفحات */}
          {totalCompatPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                عرض {((compatPage - 1) * compatPageSize) + 1} إلى {Math.min(compatPage * compatPageSize, filteredCompatibleGroups.length)} من إجمالي {filteredCompatibleGroups.length} مجموعة
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  disabled={compatPage <= 1}
                  onClick={() => setCompatPage(p => Math.max(1, p - 1))}
                >
                  السابق
                </button>
                <span style={{ fontSize: 13, padding: '0 8px' }}>
                  صفحة {compatPage} من {totalCompatPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  disabled={compatPage >= totalCompatPages}
                  onClick={() => setCompatPage(p => Math.min(totalCompatPages, p + 1))}
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────── نافذة منبثقة: تفاصيل المجموعة والـ 5 دارسين ───────── */}
      {selectedCompatGroup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}>
          <div className="box-card" style={{
            width: '100%',
            maxWidth: 780,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            borderRadius: 12,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>كشف مجموعة متوافقة رقم {selectedCompatGroup.displayNo}</span>
                  {selectedCompatGroup.isComplete ? (
                    <span style={{ fontSize: 12, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 10 }}>
                      مكتملة (5 / 5 دارسين)
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: 10 }}>
                      قيد الاكتمال ({selectedCompatGroup.count} / 5)
                    </span>
                  )}
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 15, flexWrap: 'wrap', marginTop: 6 }}>
                  <span>الرواق: <strong>{selectedCompatGroup.rowaq}</strong></span>
                  <span>المستوى: <strong>{selectedCompatGroup.level}</strong></span>
                  <span>السورة: <strong>{selectedCompatGroup.stopped_surah}</strong></span>
                  <span>الأيام المناسبة: <strong>{selectedCompatGroup.preferred_days}</strong></span>
                  <span>التوقيت المختار: <strong>{selectedCompatGroup.preferred_time}</strong></span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 8px', borderRadius: '50%' }}
                onClick={() => setSelectedCompatGroup(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="table-wrapper" style={{ marginBottom: 16 }}>
              <table className="management-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: 40 }}>م</th>
                    <th>اسم الدارس</th>
                    <th style={{ textAlign: 'center' }}>الرقم القومي / جواز السفر</th>
                    <th style={{ textAlign: 'center' }}>رقم التليفون</th>
                    <th style={{ textAlign: 'center' }}>المحافظة</th>
                    <th style={{ textAlign: 'center' }}>الأيام المفضلة</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCompatGroup.members.map((m, idx) => (
                    <tr key={m.id || idx}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{m.name || 'بدون اسم'}</td>
                      <td style={{ textAlign: 'center' }} dir="ltr">{m.national_id || m.passport_no || '-'}</td>
                      <td style={{ textAlign: 'center' }} dir="ltr">
                        {m.phone ? (
                          <a
                            href={`https://wa.me/20${String(m.phone).replace(/^0+/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#10b981', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {m.phone}
                          </a>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>{m.governorate || '-'}</td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>{m.preferred_days || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => exportSingleCompatibleGroup(selectedCompatGroup)}
                >
                  <Download size={14} /> تصدير إكسيل
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => copyGroupRoster(selectedCompatGroup)}
                >
                  {copiedGroupDisplayNo === selectedCompatGroup.displayNo ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={14} /> تم النسخ
                    </span>
                  ) : (
                    <>
                      <Copy size={14} /> نسخ بيانات الدارسين
                    </>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#3b82f6', borderColor: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const g = selectedCompatGroup;
                    setSelectedCompatGroup(null);
                    setMergeModalGroup(g);
                    setMergeTargetSessionNo('');
                  }}
                >
                  <GitMerge size={14} /> دمج في حلقة أصلية
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSelectedCompatGroup(null)}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────── نافذة منبثقة: دمج المجموعة في حلقة أصلية ───────── */}
      {mergeModalGroup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}>
          <div className="box-card" style={{
            width: '100%',
            maxWidth: 620,
            padding: 24,
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 17, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitMerge size={18} style={{ color: '#3b82f6' }} />
                تسكين ودمج المجموعة {mergeModalGroup.displayNo} ({mergeModalGroup.count} دارسين)
              </h3>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '3px 8px', borderRadius: '50%' }}
                onClick={() => setMergeModalGroup(null)}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <div><strong>الرواق:</strong> {mergeModalGroup.rowaq}</div>
              <div><strong>المستوى:</strong> {mergeModalGroup.level}</div>
              <div><strong>السورة المتوقف عندها:</strong> {mergeModalGroup.stopped_surah}</div>
              <div><strong>الأيام المناسبة:</strong> {mergeModalGroup.preferred_days}</div>
              <div><strong>التوقيت المختار:</strong> {mergeModalGroup.preferred_time}</div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, display: 'block' }}>
                اختر الحلقة الأصلية لتسكين الدارسين الخمسة فيها:
              </label>
              <select
                value={mergeTargetSessionNo}
                onChange={e => setMergeTargetSessionNo(e.target.value)}
                className="form-control"
                style={{ fontSize: 14, marginBottom: 8 }}
              >
                <option value="">-- اختر رقم الحلقة من القائمة المتاحة --</option>
                {platformSessions.map(s => (
                  <option key={s.id || s.session_no} value={s.session_no}>
                    حلقة رقم {s.session_no} — المحفظ: {s.mohfez_name || 'غير محدد'} ({s.rowaq || ''})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                أو اكتب رقم الحلقة يدوياً في حال إنشاء حلقة جديدة:
              </div>
              <input
                type="text"
                value={mergeTargetSessionNo}
                onChange={e => setMergeTargetSessionNo(e.target.value)}
                placeholder="أدخل رقم الحلقة الأصلية (مثال: 101)"
                className="form-control"
                style={{ marginTop: 6, fontSize: 13 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>
                الدارسون الخمسة الذين سيتم تسكينهم في الحلقة:
              </div>
              <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6, padding: 6 }}>
                {mergeModalGroup.members.map((m, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '3px 6px', borderBottom: i < mergeModalGroup.members.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    {i + 1}- {m.name} ({m.phone || 'بدون هاتف'})
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setMergeModalGroup(null)}
                disabled={mergeIsSubmitting}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                onClick={handleConfirmMergeSession}
                disabled={mergeIsSubmitting || !mergeTargetSessionNo}
              >
                {mergeIsSubmitting ? 'جاري التسكين والدمج...' : 'تأكيد تسكين الدارسين في الحلقة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlatformApplicantsList;
