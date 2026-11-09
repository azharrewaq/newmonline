import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import egyptCenters from '../data/egyptCenters';
import {
  managersAPI, coordinatorsAPI, mohfezsAPI, studentsAPI, branchesAPI, sessionsAPI, usersAPI,
  monthlyReportsAPI, followUpReportsAPI, applicantsAPI, rowaqsAPI, applicantBranchesAPI,
  attendancesAPI, sessionReportsAPI, platformTopManagementAPI, platformSupervisorsAPI, platformCoordinatorsAPI,
  platformMohfezsAPI, platformSessionsAPI, platformStudentsAPI, platformApplicantsAPI,
  platformRowaqsAPI, administrationsAPI, rolePermissionsAPI,
  shariaCoursesAPI, shariaBranchesAPI, shariaStudentsAPI, shariaTeachersAPI, shariaLivesAPI, shariaDailyReportsAPI, shariaNewsAPI,
  holidaysAPI, announcementsAPI, announcementRepliesAPI, staffAttendancesAPI, substitutionsAPI, placementGroupsAPI
} from '../utils/apiService';
import { setActiveSubstitutions } from '../utils/userScopeHelper';
import { findStudentRecord, getStudentsOfSession, toLocalDateStr } from '../utils/sessionHelpers';
import { createDefaultPlacementGroups, normalizeExamDate, normalizeExamTime, rescheduleApplicantDay9, splitApplicantsIntoQuarterTimes } from '../utils/placementHelpers';

const AppDataContext = createContext(null);

// Helper functions to manage localStorage
const getFromLocalStorage = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
};

const saveToLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
};

const normalizeArabic = (str) => {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .normalize('NFKD')
    .normalize('NFC')
    .replace(/ً/g, '')
    .replace(/ٌ/g, '')
    .replace(/ٍ/g, '')
    .replace(/َ/g, '')
    .replace(/ُ/g, '')
    .replace(/ِ/g, '')
    .replace(/ّ/g, '')
    .replace(/ْ/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
};

const governorates = Object.keys(egyptCenters || {});
const normalizedGovernoratesSet = new Set(governorates.map(g => normalizeArabic(g)));

const resolveGeographicFields = (adminVal, centerVal, branchVal, branchesList) => {
  const normAdmin = normalizeArabic(adminVal);
  const normCenter = normalizeArabic(centerVal);
  const normBranch = normalizeArabic(branchVal);

  if (!branchesList || branchesList.length === 0) {
    return { admin: adminVal, center: centerVal, branch: branchVal };
  }

  // 1. Check if centerVal is a valid branch name, and branchVal is NOT (shifted columns)
  const isBranchValValid = normBranch && branchesList.some(b => normalizeArabic(b.name) === normBranch);
  const isCenterValValid = normCenter && branchesList.some(b => normalizeArabic(b.name) === normCenter);

  if (isCenterValValid && !isBranchValValid) {
    const matchedBranch = branchesList.find(b => 
      normalizeArabic(b.name) === normCenter &&
      (normalizeArabic(b.center) === normAdmin || normalizeArabic(b.admin) === normAdmin)
    ) || branchesList.find(b => normalizeArabic(b.name) === normCenter);
    
    if (matchedBranch) {
      return { admin: matchedBranch.admin, center: matchedBranch.center, branch: matchedBranch.name };
    }
  }

  // 2. Exact match
  let matchedBranch = branchesList.find(b => 
    normalizeArabic(b.name) === normBranch &&
    normalizeArabic(b.center) === normCenter &&
    normalizeArabic(b.admin) === normAdmin
  );
  if (matchedBranch) {
    return { admin: matchedBranch.admin, center: matchedBranch.center, branch: matchedBranch.name };
  }

  // 3. Match by branch name (normBranch)
  if (isBranchValValid) {
    const matchedBranch = branchesList.find(b => 
      normalizeArabic(b.name) === normBranch &&
      (normalizeArabic(b.center) === normCenter || normalizeArabic(b.admin) === normAdmin)
    ) || branchesList.find(b => normalizeArabic(b.name) === normBranch);

    if (matchedBranch) {
      return { admin: matchedBranch.admin, center: matchedBranch.center, branch: matchedBranch.name };
    }
  }

  return { admin: adminVal, center: centerVal, branch: branchVal };
};

const defaultPermissions = {
  admin: {
    sessions: { view: true, add: true, edit: true, delete: true },
    mohfezs: { view: true, add: true, edit: true, delete: true },
    coordinators: { view: true, add: true, edit: true, delete: true },
    students: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    branches: { view: true, add: true, edit: true, delete: true },
  },
  rowaq_admin: {
    sessions: { view: true, add: true, edit: true, delete: true },
    mohfezs: { view: true, add: true, edit: true, delete: true },
    coordinators: { view: true, add: true, edit: true, delete: true },
    students: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    branches: { view: true, add: true, edit: true, delete: true },
  },
  platform_admin: {
    sessions: { view: true, add: true, edit: true, delete: true },
    mohfezs: { view: true, add: true, edit: true, delete: true },
    coordinators: { view: true, add: true, edit: true, delete: true },
    students: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    branches: { view: true, add: true, edit: true, delete: true },
  },
  rowaq_manager: {
    sessions: { view: true, add: true, edit: true, delete: false },
    mohfezs: { view: true, add: true, edit: true, delete: false },
    coordinators: { view: true, add: true, edit: true, delete: false },
    students: { view: true, add: true, edit: true, delete: false },
    reports: { view: true, add: true, edit: true, delete: true },
    branches: { view: true, add: true, edit: true, delete: false },
  },
  rowaq_tech: {
    sessions: { view: true, add: true, edit: true, delete: false },
    mohfezs: { view: true, add: true, edit: true, delete: false },
    coordinators: { view: true, add: true, edit: true, delete: false },
    students: { view: true, add: true, edit: true, delete: false },
    reports: { view: true, add: true, edit: true, delete: false },
    branches: { view: true, add: true, edit: true, delete: false },
  },
  rowaq_member: {
    sessions: { view: true, add: false, edit: false, delete: false },
    mohfezs: { view: true, add: false, edit: false, delete: false },
    coordinators: { view: true, add: false, edit: false, delete: false },
    students: { view: true, add: false, edit: false, delete: false },
    reports: { view: true, add: true, edit: false, delete: false },
    branches: { view: true, add: false, edit: false, delete: false },
  },
  branch_admin_coordinator: {
    sessions: { view: true, add: true, edit: true, delete: false },
    mohfezs: { view: true, add: false, edit: false, delete: false },
    coordinators: { view: true, add: false, edit: false, delete: false },
    students: { view: true, add: true, edit: true, delete: false },
    reports: { view: true, add: true, edit: true, delete: false },
    branches: { view: true, add: false, edit: false, delete: false },
  },
  branch_scientific_coordinator: {
    sessions: { view: true, add: false, edit: false, delete: false },
    mohfezs: { view: true, add: false, edit: false, delete: false },
    coordinators: { view: true, add: false, edit: false, delete: false },
    students: { view: true, add: false, edit: false, delete: false },
    reports: { view: true, add: true, edit: false, delete: false },
    branches: { view: true, add: false, edit: false, delete: false },
  },
  mohfez: {
    sessions: { view: true, add: false, edit: false, delete: false },
    mohfezs: { view: true, add: false, edit: false, delete: false },
    coordinators: { view: true, add: false, edit: false, delete: false },
    students: { view: true, add: false, edit: false, delete: false },
    reports: { view: true, add: true, edit: false, delete: false },
    branches: { view: true, add: false, edit: false, delete: false },
  },
  platform_supervisor: {
    sessions: { view: true, add: true, edit: true, delete: false },
    mohfezs: { view: true, add: true, edit: true, delete: false },
    coordinators: { view: true, add: true, edit: true, delete: false },
    students: { view: true, add: true, edit: true, delete: false },
    reports: { view: true, add: true, edit: true, delete: true },
    branches: { view: true, add: true, edit: true, delete: false },
  },
  platform_coordinator: {
    sessions: { view: true, add: true, edit: true, delete: false },
    mohfezs: { view: true, add: false, edit: false, delete: false },
    coordinators: { view: true, add: false, edit: false, delete: false },
    students: { view: true, add: true, edit: true, delete: false },
    reports: { view: true, add: true, edit: true, delete: false },
    branches: { view: true, add: false, edit: false, delete: false },
  },
  platform_mohfez: {
    sessions: { view: true, add: false, edit: false, delete: false },
    mohfezs: { view: true, add: false, edit: false, delete: false },
    coordinators: { view: true, add: false, edit: false, delete: false },
    students: { view: true, add: false, edit: false, delete: false },
    reports: { view: true, add: true, edit: false, delete: false },
    branches: { view: true, add: false, edit: false, delete: false },
  },
  student: {
    sessions: { view: true, add: false, edit: false, delete: false },
    mohfezs: { view: false, add: false, edit: false, delete: false },
    coordinators: { view: false, add: false, edit: false, delete: false },
    students: { view: true, add: false, edit: false, delete: false },
    reports: { view: true, add: false, edit: false, delete: false },
    branches: { view: false, add: false, edit: false, delete: false },
  }
};

const normalizeStage = (stage) => {
  if (!stage) return 'التمهيدية';
  const clean = String(stage).trim();
  if (clean === 'تمهيدية') return 'التمهيدية';
  if (clean === 'متوسطة') return 'المتوسطة';
  if (clean === 'متقدمة') return 'المتقدمة';
  return clean;
};

export function AppDataProvider({ children }) {
  // Load data from localStorage or use default values
  const [managers, setManagers] = useState(() => getFromLocalStorage('managers', []));
  const [monthlyReports, setMonthlyReports] = useState(() => getFromLocalStorage('monthlyReports', []));
  const [branches, setBranches] = useState(() => getFromLocalStorage('branches', []));
  const [coordinators, setCoordinators] = useState(() => getFromLocalStorage('coordinators', []));
  const [mohfezs, setMohfezs] = useState(() => getFromLocalStorage('mohfezs', []));
  const [sessions, setSessions] = useState(() => getFromLocalStorage('sessions', []));
  const [students, setStudents] = useState(() => getFromLocalStorage('students', []));
  const [applicants, setApplicants] = useState(() => getFromLocalStorage('applicants', []));
  const [rowaqs, setRowaqs] = useState(() => getFromLocalStorage('rowaqs', []));

  const [followUpReports, setFollowUpReports] = useState(() => {
    const stored = getFromLocalStorage('followUpReports', []);
    if (stored.length > 0) return stored;

    // Auto-seed mock reports for past dates if they exist in monthlyReports
    const reports = [];
    const monthlyList = getFromLocalStorage('monthlyReports', []);

    monthlyList.forEach(m => {
      if (m.branches) {
        m.branches.forEach(b => {
          const seedDates = ['2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-23'];
          if (seedDates.includes(b.date)) {
            reports.push({
              id: Date.now() + Math.random(),
              monthlyReportId: m.id,
              branchVisitId: b.id,
              date: b.date,
              admin: m.admin,
              center: b.center,
              branch: b.branch,
              address: 'معهد بنين نصر الله - أبو حمص',
              rwaqs: ['رواق القرآن الكريم ( أطفال )'],
              workDays: ['الأحد', 'الثلاثاء', 'الخميس'],
              timeFrom: '14:00',
              timeTo: '18:00',
              followerName: m.member,
              followerSpecialty: m.specialty,
              scientificCommitment: 'نعم',
              scientificShortcoming: '',
              administrativeCommitment: 'نعم',
              administrativeShortcoming: '',
              absentCoordinators: 'لا يوجد',
              absentMohfezs: 'لا يوجد',
              exceedingHoursPercentage: '0%',
              multiLevelSessionsCount: '2',
              adultRwaqMohfezsCount: '3',
              adultRwaqDirectSessionsCount: '2',
              adultRwaqOnlineSessionsCount: '1',
              adultRwaqStudentsCount: '45',
              adultRwaqAttendanceCount: '40',
              childRwaqMohfezsCount: '5',
              childRwaqStudentsCount: '120',
              childRwaqAttendanceCount: '110',
              mohfezsCommitmentToCurriculum: 'الجميع ملتزم',
              mohfezClassManagement: 'أداء ممتاز لكل المحفظين',
              mohfezStudentBehavior: 'أداء ممتاز لكل المحفظين',
              tajweedNotebookActivated: 'نعم',
              teacherRecitationCommitment: 'كل المحفظين',
              dressCodeCommitment: 'كل المحفظين',
              monthlyTestsAndEvaluations: 'نعم',
              topStudentsNames: 'أحمد محمد، محمود علي',
              positives: 'التزام المحفظين والطلاب وحسن التعامل',
              negatives: 'لا توجد سلبيات تذكر',
              recommendations: 'الاستمرار على نفس المستوى المتميز',
              generalComments: 'زيارة ناجحة ومثمرة',
              isConfirmed: false,
              confirmationFile: ''
            });
          }
        });
      }
    });
    return reports;
  });
  const [users, setUsers] = useState(() => {
    const stored = getFromLocalStorage('users', null);
    // توحيد بيانات المستخدمين القديمة لضمان عمل تسجيل الدخول
    if (stored && stored.length > 0) {
      const normalized = stored.map(u => ({
        ...u,
        username: u.national_id || u.email || u.username || '',
        email: u.email || u.national_id || '',
        password: u.password || u.record_number || '',
        record_number: u.record_number || u.password || '',
      }));
      // ضمان وجود مستخدم الأدمن دائماً — لكن بدون تجاوز باسورده المحفوظ
      const hasAdmin = normalized.some(u => u.national_id === 'admin' || u.username === 'admin');
      if (hasAdmin) return normalized;
      // لم يوجد أدمن — نضيف الافتراضي فقط كإجراء احتياطي
      const fallbackAdmin = { id: 1, username: 'admin', email: 'admin', national_id: 'admin', password: '123', record_number: '123', name: 'Admin', role: 'admin', created_at: new Date().toLocaleDateString('ar-EG') };
      return [fallbackAdmin, ...normalized];
    }
    // لا يوجد بيانات محفوظة — سيتم جلبها من الخادم لاحقاً
    const fallbackAdmin = { id: 1, username: 'admin', email: 'admin', national_id: 'admin', password: '123', record_number: '123', name: 'Admin', role: 'admin', created_at: new Date().toLocaleDateString('ar-EG') };
    return [fallbackAdmin];
  });
  const [applicantBranches, setApplicantBranches] = useState(() => getFromLocalStorage('applicantBranches', []));
  const [auditLogs, setAuditLogs] = useState(() => getFromLocalStorage('auditLogs', []));
  const [attendances, setAttendances] = useState(() => getFromLocalStorage('attendances', []));
  const [sessionReports, setSessionReports] = useState(() => getFromLocalStorage('sessionReports', []));
  const [holidays, setHolidays] = useState(() => getFromLocalStorage('holidays', []));
  const [announcements, setAnnouncements] = useState(() => getFromLocalStorage('announcements', []));
  const [announcementReplies, setAnnouncementReplies] = useState(() => getFromLocalStorage('announcementReplies', []));
  const [staffAttendances, setStaffAttendances] = useState(() => getFromLocalStorage('staffAttendances', []));
  const [substitutions, setSubstitutions] = useState(() => getFromLocalStorage('substitutions', []));
  // يُحدَّث أثناء الرسم ليستعمله منطق الصلاحيات (userScopeHelper) في نفس الدورة
  setActiveSubstitutions(substitutions);

  // Platform Dashboard States
  const [platformTopManagement, setPlatformTopManagement] = useState(() => getFromLocalStorage('platformTopManagement', []));
  const [platformSupervisors, setPlatformSupervisors] = useState(() => getFromLocalStorage('platformSupervisors', []));
  const [platformCoordinators, setPlatformCoordinators] = useState(() => getFromLocalStorage('platformCoordinators', []));
  const [platformMohfezs, setPlatformMohfezs] = useState(() => getFromLocalStorage('platformMohfezs', []));
  const [platformSessions, setPlatformSessions] = useState(() => getFromLocalStorage('platformSessions', []));
  const [platformStudents, setPlatformStudents] = useState(() => getFromLocalStorage('platformStudents', []));
  const [platformApplicants, setPlatformApplicants] = useState(() => {
    const stored = getFromLocalStorage('platformApplicants', []);
    return (Array.isArray(stored) ? stored : []).map(a => {
      const norm = {
        ...a,
        exam_date: a.exam_date ? normalizeExamDate(a.exam_date) : '',
        exam_time: a.exam_time ? normalizeExamTime(a.exam_time) : ''
      };
      return rescheduleApplicantDay9(norm);
    });
  });
  const [placementGroups, setPlacementGroups] = useState(() => {
    const stored = getFromLocalStorage('placementGroups', []);
    return Array.isArray(stored) && stored.length === 40 ? stored : createDefaultPlacementGroups();
  });
  const [platformRowaqs, setPlatformRowaqs] = useState(() => getFromLocalStorage('platformRowaqs', []));
  const [administrations, setAdministrations] = useState(() => {
    const defaultAdmins = Object.keys(egyptCenters).map((gov, index) => ({
      id: String(1000 + index),
      name: gov,
      manager: '-',
      centers_count: egyptCenters[gov]?.length || 0,
      created_at: new Date().toLocaleDateString('ar-EG')
    }));
    return getFromLocalStorage('administrations', defaultAdmins);
  });

  const [theme, setTheme] = useState(() => getFromLocalStorage('theme_mode', 'light'));
  const [rolePermissions, setRolePermissions] = useState(() => {
    const loaded = getFromLocalStorage('rolePermissions', defaultPermissions);
    if (loaded && (!loaded.rowaq_manager || !loaded.rowaq_admin || !loaded.platform_admin)) {
      return defaultPermissions;
    }
    return loaded;
  });

  // Sharia Dashboard States
  const [shariaCourses, setShariaCourses] = useState(() => {
    const raw = getFromLocalStorage('sharia_courses', []);
    return raw.map(c => ({ ...c, stage: normalizeStage(c.stage) }));
  });
  const [shariaNews, setShariaNews] = useState(() => getFromLocalStorage('sharia_news', [
    {
      id: 'sn-1',
      title: "بدء الفصل الدراسي الجديد لعام 2026",
      content: "يسر قطاع العلوم الشرعية والعربية بالجامع الأزهر الشريف الإعلان عن بدء الدراسة في فروع الرواق الأزهري لمرحلة العلوم الشرعية والعربية بكافة المحافظات بدءاً من السبت القادم. يرجى من جميع الدارسين مراجعة المناهج والجداول المرفقة.",
      date: new Date().toISOString().split('T')[0],
      category: "إعلان عام",
      status: "منشور",
      attachments: []
    }
  ]));
  const [shariaBranches, setShariaBranches] = useState(() => getFromLocalStorage('sharia_branches', [
    { id: 'sb-1', name: 'فرع معهد تفهنا الأشراف الشرعي', governorate: 'الدقهلية', code: 'SH-DK01', address: 'معهد فتيات تفهنا الأشراف' },
    { id: 'sb-2', name: 'فرع الجامع الأزهر الرئيسي', governorate: 'الجامع الأزهر', code: 'SH-AZ01', address: 'مقر الجامع الأزهر الشريف بالقاهرة' }
  ]));
  const [shariaStudents, setShariaStudents] = useState(() => {
    const raw = getFromLocalStorage('sharia_students', []);
    return raw.map(s => ({ ...s, stage: normalizeStage(s.stage) }));
  });
  const [shariaTeachers, setShariaTeachers] = useState(() => getFromLocalStorage('sharia_teachers', []));
  const [shariaLiveLectures, setShariaLiveLectures] = useState(() => {
    const raw = getFromLocalStorage('sharia_live', [
      {
        id: 1,
        title: 'شرح كتاب التوحيد من صحيح البخاري',
        governorate: 'الجامع الأزهر',
        stage: 'التمهيدية',
        level: 'المستوى الأول',
        discipline: '—',
        teacher: 'أ.د. أحمد المعتز بالله',
        day: 'الأحد',
        timeStart: '18:00',
        timeEnd: '20:00',
        link: 'https://zoom.us/j/123456789',
        isWeekly: true,
        status: 'بث مباشر الآن'
      }
    ]);
    return raw.map(l => ({ ...l, stage: normalizeStage(l.stage) }));
  });

  const [shariaSchedules, setShariaSchedules] = useState(() => {
    const raw = getFromLocalStorage('sharia_schedules', [
      {
        id: 'sched-1',
        governorate: 'الجامع الأزهر',
        branch: 'فرع الجامع الأزهر الرئيسي',
        stage: 'التمهيدية',
        level: 'المستوى الأول',
        discipline: '—',
        day: 'الأحد',
        timeStart: '10:00',
        timeEnd: '12:00',
        teacher: 'أ.د. أحمد المعتز بالله',
        place: 'الرواق العباسي',
        isWeekly: true
      }
    ]);
    return raw.map(s => ({ ...s, stage: normalizeStage(s.stage) }));
  });

  const [shariaAttendance, setShariaAttendance] = useState(() => getFromLocalStorage('sharia_attendance', []));
  const [lectureAccessLogs, setLectureAccessLogs] = useState(() => getFromLocalStorage('lecture_access_logs', []));
  const [shariaDailyReports, setShariaDailyReports] = useState(() => getFromLocalStorage('sharia_daily_reports', []));

  // Save permissions to localStorage
  useEffect(() => {
    saveToLocalStorage('rolePermissions', rolePermissions);
  }, [rolePermissions]);

  // Save theme to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveToLocalStorage('theme_mode', theme);
  }, [theme]);

  // Database Persistent Synchronization
  const [dbSynced, setDbSynced] = useState(false);
  const deletedApplicantIdsRef = useRef(new Set());
  const pendingApplicantOpsRef = useRef(0);

  useEffect(() => {
    const syncWithBackend = async () => {
      try {
        console.log('🔄 Syncing with backend database...');

        const syncCollection = async (api, state, setState, key, mapper = null) => {
          const remoteData = await api.getAll().catch(() => null);
          if (Array.isArray(remoteData)) {
            let normalizedData = remoteData.map(item => ({
              ...item,
              id: item.id || item._id
            }));
            if (mapper) normalizedData = normalizedData.map(mapper);
            setState(normalizedData);
            saveToLocalStorage(key, normalizedData);
            if (remoteData.length > 0) {
              console.log(`✓ Fetched ${normalizedData.length} items for ${key} from MongoDB`);
            }
          }
        };

        await syncCollection(managersAPI, managers, setManagers, 'managers');
        await syncCollection(coordinatorsAPI, coordinators, setCoordinators, 'coordinators');
        await syncCollection(mohfezsAPI, mohfezs, setMohfezs, 'mohfezs');
        await syncCollection(studentsAPI, students, setStudents, 'students');
        await syncCollection(branchesAPI, branches, setBranches, 'branches');
        await syncCollection(sessionsAPI, sessions, setSessions, 'sessions');
        // Sync users — use remote data as-is to preserve updated admin password
        const remoteUsers = await usersAPI.getAll().catch(() => null);
        if (remoteUsers) {
          const normalizedRemote = remoteUsers.map(item => ({
            ...item,
            id: item.id || item._id,
            password: item.password || item.record_number || '',
            record_number: item.record_number || item.password || '',
          }));

          // إزالة التكرار: إبقاء آخر سجل لكل username/national_id فقط
          // هذا يحل مشكلة تكرار الأدمن بسبب خطأ upsert السابق
          const seenKeys = new Map();
          normalizedRemote.forEach(u => {
            const key = String(u.username || u.national_id || u.email || '').trim().toLowerCase();
            if (!key) return;
            // نفضل السجل الذي له id أحدث (أكبر قيمة) أو الذي يحتوي على باسورد أكثر حداثة
            const existing = seenKeys.get(key);
            if (!existing) {
              seenKeys.set(key, u);
            } else {
              // احتفظ بالسجل الذي تاريخه أحدث أو له _id أكبر
              const existingIdStr = String(existing._id || '');
              const currentIdStr = String(u._id || '');
              if (currentIdStr > existingIdStr) {
                // السجل الجديد أحدث — استخدمه لكن احتفظ بالباسورد الأحدث
                seenKeys.set(key, { ...u, password: u.password || existing.password, record_number: u.record_number || existing.record_number });
                // احذف السجل المكرر القديم من قاعدة البيانات
                usersAPI.delete(existing._id || existing.id).catch(() => {});
              } else {
                // السجل الموجود أحدث — احذف الجديد المكرر
                usersAPI.delete(u._id || u.id).catch(() => {});
              }
            }
          });
          const deduplicatedRemote = Array.from(seenKeys.values());

          const hasAdmin = deduplicatedRemote.some(u => u.national_id === 'admin' || u.username === 'admin');
          let finalUsers;
          if (hasAdmin) {
            // الأدمن موجود في قاعدة البيانات — نستخدم بياناته كما هي (بما فيها الباسورد الجديد)
            finalUsers = deduplicatedRemote;
          } else {
            // الأدمن غير موجود في MongoDB — نأخذ باسورده من localStorage إن وُجد
            let adminFromLocal = null;
            try {
              const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
              adminFromLocal = localUsers.find(u => u.national_id === 'admin' || u.username === 'admin');
            } catch (e) { /* ignore */ }
            const localAdminPass = adminFromLocal?.password || adminFromLocal?.record_number || '123';
            const fallbackAdmin = {
              id: 1, username: 'admin', email: 'admin', national_id: 'admin',
              password: localAdminPass, record_number: localAdminPass,
              name: adminFromLocal?.name || 'Admin', role: 'admin'
            };
            finalUsers = [fallbackAdmin, ...deduplicatedRemote];
            // أنشئ الأدمن في MongoDB حتى يكون متاحاً للأجهزة الأخرى
            usersAPI.create(fallbackAdmin).catch(() => {});
          }
          setUsers(finalUsers);
          saveToLocalStorage('users', finalUsers);
          console.log(`✓ Fetched ${finalUsers.length} users from MongoDB (deduped, admin password preserved)`);
        }

        await syncCollection(monthlyReportsAPI, monthlyReports, setMonthlyReports, 'monthlyReports');
        await syncCollection(followUpReportsAPI, followUpReports, setFollowUpReports, 'followUpReports');
        await syncCollection(applicantsAPI, applicants, setApplicants, 'applicants');
        await syncCollection(rowaqsAPI, rowaqs, setRowaqs, 'rowaqs');
        await syncCollection(applicantBranchesAPI, applicantBranches, setApplicantBranches, 'applicantBranches');
        await syncCollection(attendancesAPI, attendances, setAttendances, 'attendances');
        await syncCollection(sessionReportsAPI, sessionReports, setSessionReports, 'sessionReports');
        await syncCollection(holidaysAPI, holidays, setHolidays, 'holidays');
        await syncCollection(announcementsAPI, announcements, setAnnouncements, 'announcements');
        await syncCollection(announcementRepliesAPI, announcementReplies, setAnnouncementReplies, 'announcementReplies');
        await syncCollection(staffAttendancesAPI, staffAttendances, setStaffAttendances, 'staffAttendances');
        await syncCollection(substitutionsAPI, substitutions, setSubstitutions, 'substitutions');

        await syncCollection(platformTopManagementAPI, platformTopManagement, setPlatformTopManagement, 'platformTopManagement');
        await syncCollection(platformSupervisorsAPI, platformSupervisors, setPlatformSupervisors, 'platformSupervisors');
        await syncCollection(platformCoordinatorsAPI, platformCoordinators, setPlatformCoordinators, 'platformCoordinators');
        await syncCollection(platformMohfezsAPI, platformMohfezs, setPlatformMohfezs, 'platformMohfezs');
        await syncCollection(platformSessionsAPI, platformSessions, setPlatformSessions, 'platformSessions');
        await syncCollection(platformStudentsAPI, platformStudents, setPlatformStudents, 'platformStudents');
        await syncCollection(platformApplicantsAPI, platformApplicants, setPlatformApplicants, 'platformApplicants', a => {
          const norm = {
            ...a,
            exam_date: a.exam_date ? normalizeExamDate(a.exam_date) : '',
            exam_time: a.exam_time ? normalizeExamTime(a.exam_time) : ''
          };
          return rescheduleApplicantDay9(norm);
        });
        // مزامنة الـ 40 مجموعة لتحديد المستوى (20 مجموعة 6-8 م + 20 مجموعة 8-10 م)
        const remotePG = await placementGroupsAPI.getAll().catch(() => null);
        if (remotePG) {
          if (remotePG.length === 0) {
            const defaults = createDefaultPlacementGroups();
            placementGroupsAPI.bulkImport(defaults).catch(() => {});
            setPlacementGroups(defaults);
            saveToLocalStorage('placementGroups', defaults);
          } else {
            const normPG = remotePG
              .map(g => ({ ...g, id: g.id || g._id }))
              .sort((a, b) => (Number(a.group_no) || 0) - (Number(b.group_no) || 0));
            setPlacementGroups(normPG);
            saveToLocalStorage('placementGroups', normPG);
          }
        }
        await syncCollection(platformRowaqsAPI, platformRowaqs, setPlatformRowaqs, 'platformRowaqs');

        await syncCollection(administrationsAPI, administrations, setAdministrations, 'administrations');
        await syncCollection(rolePermissionsAPI, rolePermissions, setRolePermissions, 'rolePermissions');

        // Sync Sharia Collections
        await syncCollection(shariaCoursesAPI, shariaCourses, setShariaCourses, 'sharia_courses', c => ({ ...c, stage: normalizeStage(c.stage) }));
        await syncCollection(shariaBranchesAPI, shariaBranches, setShariaBranches, 'sharia_branches');
        await syncCollection(shariaStudentsAPI, shariaStudents, setShariaStudents, 'sharia_students', s => ({ ...s, stage: normalizeStage(s.stage) }));
        await syncCollection(shariaTeachersAPI, shariaTeachers, setShariaTeachers, 'sharia_teachers');
        await syncCollection(shariaLivesAPI, shariaLiveLectures, setShariaLiveLectures, 'sharia_live', l => ({ ...l, stage: normalizeStage(l.stage) }));
        await syncCollection(shariaDailyReportsAPI, shariaDailyReports, setShariaDailyReports, 'sharia_daily_reports');
        await syncCollection(shariaNewsAPI, shariaNews, setShariaNews, 'sharia_news');

        // One-time correction for swapped admin and decision_no fields and shifted columns in database
        try {
          const storedBranches = getFromLocalStorage('branches', []);

          const storedCoordinators = getFromLocalStorage('coordinators', []);
          let coordinatorsUpdated = false;
          const updatedCoordinators = storedCoordinators.map(c => {
            let currentAdmin = c.admin || '';
            let currentDecision = c.decision_no || '';
            let currentCenter = c.center || '';
            let currentBranch = c.branch || '';
            let itemChanged = false;

            const normAdmin = normalizeArabic(currentAdmin);
            const normDecision = normalizeArabic(currentDecision);
            const isSwapped = 
              currentDecision && 
              normalizedGovernoratesSet.has(normDecision) && 
              !normalizedGovernoratesSet.has(normAdmin);
            if (isSwapped) {
              const temp = currentAdmin;
              currentAdmin = currentDecision;
              currentDecision = temp;
              itemChanged = true;
            }

            const resolved = resolveGeographicFields(currentAdmin, currentCenter, currentBranch, storedBranches);
            if (resolved.admin !== currentAdmin || resolved.center !== currentCenter || resolved.branch !== currentBranch) {
              currentAdmin = resolved.admin;
              currentCenter = resolved.center;
              currentBranch = resolved.branch;
              itemChanged = true;
            }

            if (itemChanged) {
              coordinatorsUpdated = true;
              console.log(`[Sync] Correcting coordinator ${c.name} fields:`, { admin: currentAdmin, center: currentCenter, branch: currentBranch, decision_no: currentDecision });
              coordinatorsAPI.update(c.id, { 
                admin: currentAdmin, 
                center: currentCenter, 
                branch: currentBranch, 
                decision_no: currentDecision 
              }).catch(err => console.error(err));
              return { ...c, admin: currentAdmin, center: currentCenter, branch: currentBranch, decision_no: currentDecision };
            }
            return c;
          });
          if (coordinatorsUpdated) {
            setCoordinators(updatedCoordinators);
            saveToLocalStorage('coordinators', updatedCoordinators);
          }

          const storedMohfezs = getFromLocalStorage('mohfezs', []);
          let mohfezsUpdated = false;
          const updatedMohfezs = storedMohfezs.map(m => {
            let currentAdmin = m.admin || '';
            let currentDecision = m.decision_no || '';
            let currentCenter = m.center || '';
            let currentBranch = m.branch || '';
            let itemChanged = false;

            const normAdmin = normalizeArabic(currentAdmin);
            const normDecision = normalizeArabic(currentDecision);
            const isSwapped = 
              currentDecision && 
              normalizedGovernoratesSet.has(normDecision) && 
              !normalizedGovernoratesSet.has(normAdmin);
            if (isSwapped) {
              const temp = currentAdmin;
              currentAdmin = currentDecision;
              currentDecision = temp;
              itemChanged = true;
            }

            const resolved = resolveGeographicFields(currentAdmin, currentCenter, currentBranch, storedBranches);
            if (resolved.admin !== currentAdmin || resolved.center !== currentCenter || resolved.branch !== currentBranch) {
              currentAdmin = resolved.admin;
              currentCenter = resolved.center;
              currentBranch = resolved.branch;
              itemChanged = true;
            }

            if (itemChanged) {
              mohfezsUpdated = true;
              console.log(`[Sync] Correcting mohfez ${m.name} fields:`, { admin: currentAdmin, center: currentCenter, branch: currentBranch, decision_no: currentDecision });
              mohfezsAPI.update(m.id, { 
                admin: currentAdmin, 
                center: currentCenter, 
                branch: currentBranch, 
                decision_no: currentDecision 
              }).catch(err => console.error(err));
              return { ...m, admin: currentAdmin, center: currentCenter, branch: currentBranch, decision_no: currentDecision };
            }
            return m;
          });
          if (mohfezsUpdated) {
            setMohfezs(updatedMohfezs);
            saveToLocalStorage('mohfezs', updatedMohfezs);
          }

          const storedSessions = getFromLocalStorage('sessions', []);
          let sessionsUpdated = false;
          const updatedSessions = storedSessions.map(s => {
            let currentAdmin = s.admin || '';
            let currentCenter = s.center || '';
            let currentBranch = s.branch || '';
            let itemChanged = false;

            const resolved = resolveGeographicFields(currentAdmin, currentCenter, currentBranch, storedBranches);
            if (resolved.admin !== currentAdmin || resolved.center !== currentCenter || resolved.branch !== currentBranch) {
              currentAdmin = resolved.admin;
              currentCenter = resolved.center;
              currentBranch = resolved.branch;
              itemChanged = true;
            }

            if (itemChanged) {
              sessionsUpdated = true;
              console.log(`[Sync] Correcting session ${s.session_no} fields:`, { admin: currentAdmin, center: currentCenter, branch: currentBranch });
              sessionsAPI.update(s.id, { 
                admin: currentAdmin, 
                center: currentCenter, 
                branch: currentBranch 
              }).catch(err => console.error(err));
              return { ...s, admin: currentAdmin, center: currentCenter, branch: currentBranch };
            }
            return s;
          });
          if (sessionsUpdated) {
            setSessions(updatedSessions);
            saveToLocalStorage('sessions', updatedSessions);
          }

          const storedStudents = getFromLocalStorage('students', []);
          let studentsUpdated = false;
          const updatedStudents = storedStudents.map(st => {
            let currentAdmin = st.admin || '';
            let currentCenter = st.center || '';
            let currentBranch = st.branch || '';
            let itemChanged = false;

            const resolved = resolveGeographicFields(currentAdmin, currentCenter, currentBranch, storedBranches);
            if (resolved.admin !== currentAdmin || resolved.center !== currentCenter || resolved.branch !== currentBranch) {
              currentAdmin = resolved.admin;
              currentCenter = resolved.center;
              currentBranch = resolved.branch;
              itemChanged = true;
            }

            if (itemChanged) {
              studentsUpdated = true;
              console.log(`[Sync] Correcting student ${st.name} fields:`, { admin: currentAdmin, center: currentCenter, branch: currentBranch });
              studentsAPI.update(st.id, { 
                admin: currentAdmin, 
                center: currentCenter, 
                branch: currentBranch 
              }).catch(err => console.error(err));
              return { ...st, admin: currentAdmin, center: currentCenter, branch: currentBranch };
            }
            return st;
          });
          if (studentsUpdated) {
            setStudents(updatedStudents);
            saveToLocalStorage('students', updatedStudents);
          }

          const storedManagers = getFromLocalStorage('managers', []);
          let managersUpdated = false;
          const updatedManagers = storedManagers.map(m => {
            const mAdmin = m.admin || '';
            const mDecision = m.decision_no || '';
            const normAdmin = normalizeArabic(mAdmin);
            const normDecision = normalizeArabic(mDecision);
            const isSwapped = 
              mDecision && 
              normalizedGovernoratesSet.has(normDecision) && 
              !normalizedGovernoratesSet.has(normAdmin);
            if (isSwapped) {
              managersUpdated = true;
              console.log(`[Sync] Correcting swapped manager ${m.name}:`, mDecision, mAdmin);
              managersAPI.update(m.id, { admin: mDecision, decision_no: mAdmin }).catch(err => console.error(err));
              return { ...m, admin: mDecision, decision_no: mAdmin };
            }
            return m;
          });
          if (managersUpdated) {
            setManagers(updatedManagers);
            saveToLocalStorage('managers', updatedManagers);
          }
        } catch (correctErr) {
          console.error('[Sync] Error during database correction:', correctErr);
        }

        console.log('✓ Database synchronization complete!');
      } catch (error) {
        console.error('✗ Backend sync error:', error);
      } finally {
        setDbSynced(true);
      }
    };

    syncWithBackend();
  }, []);

  // تطبيع بيانات المستخدمين + إنشاء حسابات تلقائية من المنسقين والمحفظين والمدراء
  // يعمل كلما تغيرت بيانات المنسقين أو المحفظين أو المدراء
  useEffect(() => {
    setUsers(prev => {
      const coordinatorNids = new Set(coordinators.map(c => String(c.national_id || '').trim()).filter(Boolean));
      const mohfezNids = new Set(mohfezs.map(m => String(m.national_id || '').trim()).filter(Boolean));
      const managerNids = new Set(managers.map(mg => String(mg.national_id || '').trim()).filter(Boolean));
      const platformCoordinatorNids = new Set(platformCoordinators.map(c => String(c.national_id || '').trim()).filter(Boolean));
      const platformSupervisorNids = new Set(platformSupervisors.map(s => String(s.national_id || '').trim()).filter(Boolean));
      const platformMohfezNids = new Set(platformMohfezs.map(m => String(m.national_id || '').trim()).filter(Boolean));
      const platformAdminNids = new Set(platformTopManagement.map(t => String(t.national_id || '').trim()).filter(Boolean));
      const platformStudentPassports = new Set(platformStudents.map(s => String(s.passport_no || s.national_id || '').trim()).filter(Boolean));
      const shariaStudentNids = new Set(shariaStudents.map(s => String(s.nationalId || '').trim()).filter(Boolean));
      const shariaTeacherNids = new Set(shariaTeachers.map(t => String(t.nationalId || '').trim()).filter(Boolean));

      // 1) تصفية وتطبيع المستخدمين الحاليين
      let filteredPrev = prev.filter(u => {
        const role = u.role || '';
        const nid = String(u.national_id || u.username || '').trim();
        if (!nid) return false;

        // Keep super admin
        if (role === 'admin' || nid === 'admin') return true;

        if (role === 'branch_admin_coordinator' || role === 'branch_scientific_coordinator') {
          return coordinatorNids.has(nid);
        }
        if (role === 'mohfez') {
          return mohfezNids.has(nid);
        }
        if (role === 'rowaq_manager' || role === 'rowaq_tech' || role === 'rowaq_member') {
          return managerNids.has(nid);
        }
        if (role === 'platform_coordinator') {
          return platformCoordinatorNids.has(nid);
        }
        if (role === 'platform_supervisor') {
          return platformSupervisorNids.has(nid);
        }
        if (role === 'platform_mohfez') {
          return platformMohfezNids.has(nid);
        }
        if (role === 'platform_admin') {
          return platformAdminNids.has(nid);
        }
        if (role === 'student') {
          return platformStudentPassports.has(nid);
        }
        if (role === 'sharia_student') {
          return shariaStudentNids.has(nid);
        }
        if (role === 'sharia_teacher') {
          return shariaTeacherNids.has(nid);
        }

        return true;
      });

      let normalized = filteredPrev.map(u => {
        const isAdminRole = u.role === 'admin';
        if (isAdminRole) {
          return {
            ...u,
            username: 'admin',
            email: 'admin',
            national_id: 'admin',
            record_number: 'admin',
            password: u.password || u.record_number || '',
          };
        }

        const nid = String(u.national_id || '').trim();
        const em = String(u.email || '').trim();
        const uname = String(u.username || '').trim();
        const pw = String(u.password || '').trim();
        const rec = String(u.record_number || '').trim();
        const reg = String(u.registry_no || '').trim();

        return {
          ...u,
          username: nid || em || uname,
          email: em || nid,
          national_id: nid || em || uname,
          password: pw || rec || reg,
          record_number: rec || pw || reg,
        };
      });

      // 2) إنشاء حسابات مستخدمين من البيانات الموجودة (منسقين، محفظين، مدراء)
      const existingNationalIds = new Set(normalized.map(u => String(u.national_id || '').trim()).filter(Boolean));
      let newUsersAdded = 0;

      // من المنسقين (شئون الأروقة)
      coordinators.forEach(c => {
        const nid = String(c.national_id || '').trim();
        const regNo = String(c.registry_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          const role = c.specialization === 'إداري' ? 'branch_admin_coordinator' : 'branch_scientific_coordinator';
          normalized.push({
            id: Date.now() + Math.random(),
            name: c.name || '',
            email: nid,
            username: nid,
            national_id: nid,
            password: regNo,
            record_number: regNo,
            phone: c.phone || '',
            role: role,
            userAdmin: c.admin || '',
            userCenter: c.center || '',
            userBranch: c.branch || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المحفظين (شئون الأروقة)
      mohfezs.forEach(m => {
        const nid = String(m.national_id || '').trim();
        const regNo = String(m.registry_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: m.name || '',
            email: nid,
            username: nid,
            national_id: nid,
            password: regNo,
            record_number: regNo,
            phone: m.phone || '',
            role: 'mohfez',
            userAdmin: m.admin || '',
            userCenter: m.center || '',
            userBranch: m.branch || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المدراء/أعضاء الإدارة (شئون الأروقة)
      managers.forEach(mg => {
        const nid = String(mg.national_id || '').trim();
        const recNo = String(mg.record_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          let role = 'rowaq_member';
          if (mg.specialty === 'مدير الإدارة') role = 'rowaq_manager';
          else if (mg.specialty === 'العضو التقني') role = 'rowaq_tech';
          normalized.push({
            id: Date.now() + Math.random(),
            name: mg.name || '',
            email: nid,
            username: nid,
            national_id: nid,
            password: recNo,
            record_number: recNo,
            phone: mg.phone || '',
            role: role,
            userAdmin: mg.admin || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المنصة: منسقين المنصة
      platformCoordinators.forEach(c => {
        const nid = String(c.national_id || '').trim();
        const regNo = String(c.registry_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: c.name || '', email: nid, username: nid, national_id: nid,
            password: regNo, record_number: regNo, phone: c.phone || '',
            role: 'platform_coordinator',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المنصة: المشرفين
      platformSupervisors.forEach(s => {
        const nid = String(s.national_id || '').trim();
        const regNo = String(s.registry_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: s.name || '', email: nid, username: nid, national_id: nid,
            password: regNo, record_number: regNo, phone: s.phone || '',
            role: 'platform_supervisor',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المنصة: المحفظين
      platformMohfezs.forEach(m => {
        const nid = String(m.national_id || '').trim();
        const regNo = String(m.registry_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: m.name || '', email: nid, username: nid, national_id: nid,
            password: regNo, record_number: regNo, phone: m.phone || '',
            role: 'platform_mohfez',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المنصة: الإدارة العليا
      platformTopManagement.forEach(t => {
        const nid = String(t.national_id || '').trim();
        const regNo = String(t.registry_no || t.record_no || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: t.name || '', email: nid, username: nid, national_id: nid,
            password: regNo, record_number: regNo, phone: t.phone || '',
            role: 'platform_admin',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من المنصة: دارسين المنصة (يستخدم رقم جواز السفر كاسم مستخدم وكلمة مرور)
      platformStudents.forEach(s => {
        const passport = String(s.passport_no || s.national_id || '').trim();
        if (passport && !existingNationalIds.has(passport)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: s.name || '',
            email: passport,
            username: passport,
            national_id: passport,
            password: passport,
            record_number: passport,
            phone: s.phone || '',
            role: 'student',
            userSession: s.session_id || s.session_no || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(passport);
          newUsersAdded++;
        }
      });

      // من العلوم الشرعية: الدارسين (الطلاب)
      shariaStudents.forEach(s => {
        const nid = String(s.nationalId || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: s.name || '',
            email: nid,
            username: nid,
            national_id: nid,
            password: nid,
            record_number: nid,
            phone: s.phone || '',
            role: 'sharia_student',
            governorate: s.governorate || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      // من العلوم الشرعية: المحاضرين (المعلمين)
      shariaTeachers.forEach(t => {
        const nid = String(t.nationalId || '').trim();
        if (nid && !existingNationalIds.has(nid)) {
          normalized.push({
            id: Date.now() + Math.random(),
            name: t.name || '',
            email: nid,
            username: nid,
            national_id: nid,
            password: nid,
            record_number: nid,
            phone: t.phone || '',
            role: 'sharia_teacher',
            governorate: t.governorate || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          });
          existingNationalIds.add(nid);
          newUsersAdded++;
        }
      });

      console.log('🔄 تطبيع بيانات المستخدمين:', normalized.length, 'مستخدم (تم إنشاء', newUsersAdded, 'حساب جديد)');
      normalized.forEach((u, i) => {
        console.log(`  [${i}] ${u.name}: national_id=${u.national_id}, password=${u.password}, role=${u.role}`);
      });
      saveToLocalStorage('users', normalized);
      return normalized;
    });
  }, [
    coordinators,
    mohfezs,
    managers,
    platformCoordinators,
    platformSupervisors,
    platformMohfezs,
    platformTopManagement,
    platformStudents,
    shariaStudents,
    shariaTeachers
  ]);

  // Save all data to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage('managers', managers);
  }, [managers]);

  useEffect(() => {
    saveToLocalStorage('monthlyReports', monthlyReports);
  }, [monthlyReports]);

  useEffect(() => {
    saveToLocalStorage('branches', branches);
  }, [branches]);

  useEffect(() => {
    saveToLocalStorage('followUpReports', followUpReports);
  }, [followUpReports]);

  useEffect(() => {
    saveToLocalStorage('coordinators', coordinators);
  }, [coordinators]);

  useEffect(() => {
    saveToLocalStorage('mohfezs', mohfezs);
  }, [mohfezs]);

  useEffect(() => {
    saveToLocalStorage('sessions', sessions);
  }, [sessions]);

  useEffect(() => {
    saveToLocalStorage('students', students);
  }, [students]);

  useEffect(() => {
    saveToLocalStorage('applicants', applicants);
  }, [applicants]);

  useEffect(() => {
    saveToLocalStorage('rowaqs', rowaqs);
  }, [rowaqs]);

  useEffect(() => {
    saveToLocalStorage('users', users);
  }, [users]);

  useEffect(() => {
    saveToLocalStorage('applicantBranches', applicantBranches);
  }, [applicantBranches]);

  useEffect(() => {
    saveToLocalStorage('auditLogs', auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveToLocalStorage('attendances', attendances);
  }, [attendances]);

  useEffect(() => {
    saveToLocalStorage('sessionReports', sessionReports);
  }, [sessionReports]);

  useEffect(() => {
    saveToLocalStorage('administrations', administrations);
  }, [administrations]);

  useEffect(() => {
    saveToLocalStorage('sharia_courses', shariaCourses);
  }, [shariaCourses]);

  useEffect(() => {
    saveToLocalStorage('sharia_branches', shariaBranches);
  }, [shariaBranches]);

  useEffect(() => {
    saveToLocalStorage('sharia_students', shariaStudents);
  }, [shariaStudents]);

  useEffect(() => {
    saveToLocalStorage('sharia_teachers', shariaTeachers);
  }, [shariaTeachers]);

  useEffect(() => {
    saveToLocalStorage('sharia_live', shariaLiveLectures);
  }, [shariaLiveLectures]);

  useEffect(() => {
    saveToLocalStorage('sharia_schedules', shariaSchedules);
  }, [shariaSchedules]);

  useEffect(() => {
    saveToLocalStorage('sharia_attendance', shariaAttendance);
  }, [shariaAttendance]);

  useEffect(() => {
    saveToLocalStorage('lecture_access_logs', lectureAccessLogs);
  }, [lectureAccessLogs]);

  useEffect(() => {
    saveToLocalStorage('sharia_daily_reports', shariaDailyReports);
  }, [shariaDailyReports]);

  useEffect(() => {
    setAdministrations(prev => {
      let changed = false;
      const next = prev.map(admin => {
        const adminManager = managers.find(m => m.admin === admin.name && m.specialty === 'مدير الإدارة');
        const managerName = adminManager ? adminManager.name : '-';
        if (admin.manager !== managerName) {
          changed = true;
          return { ...admin, manager: managerName };
        }
        return admin;
      });
      return changed ? next : prev;
    });
  }, [managers]);
  const addCenterToAdmin = (adminName, newCenter) => {
    setAdministrations(prev => prev.map(a => a.name === adminName ? { ...a, centers_count: a.centers_count + 1 } : a));
  };

  const addManager = (manager) => {
    const newManager = { ...manager, id: String(Date.now() + Math.random()) };
    setManagers(prev => [...prev, newManager]);
    managersAPI.create(newManager).catch(err => console.error(err));
  };
  const updateManager = (id, updatedManager) => {
    setManagers(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedManager } : m));
    managersAPI.update(id, updatedManager).catch(err => console.error(err));
  };
  const deleteManager = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = managers.find(m => String(m.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setManagers(prev => prev.filter(m => String(m.id) !== String(id)));
      managersAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addMonthlyReport = (report) => {
    const newReport = { ...report, id: String(Date.now() + Math.random()) };
    setMonthlyReports(prev => [...prev, newReport]);
    monthlyReportsAPI.create(newReport).catch(err => console.error(err));
  };
  const updateMonthlyReport = (id, updatedReport) => {
    setMonthlyReports(prev => prev.map(r => String(r.id) === String(id) ? { ...r, ...updatedReport } : r));
    monthlyReportsAPI.update(id, updatedReport).catch(err => console.error(err));
  };
  const deleteMonthlyReport = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setMonthlyReports(prev => prev.filter(r => String(r.id) !== String(id)));
      monthlyReportsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addBranch = (branch) => {
    const newBranch = { ...branch, id: String(Date.now() + Math.random()) };
    setBranches(prev => [...prev, newBranch]);
    branchesAPI.create(newBranch).catch(err => console.error(err));
  };
  const updateBranch = (id, updatedBranch) => {
    // 1. Update the branch itself
    setBranches(prev => prev.map(b => String(b.id) === String(id) ? { ...b, ...updatedBranch } : b));
    branchesAPI.update(id, updatedBranch).catch(err => console.error(err));

    // 2. Cascade logic
    if (updatedBranch.isArchived !== undefined) {
      const targetArchiveState = updatedBranch.isArchived;
      const branchObj = branches.find(b => String(b.id) === String(id));
      if (branchObj) {
        const { admin, center, name } = branchObj;
        const normAdmin = normalizeArabic(admin);
        const normCenter = normalizeArabic(center);
        const normName = normalizeArabic(name);

        const matchesGeographically = (item) => 
          normalizeArabic(item.admin) === normAdmin &&
          normalizeArabic(item.center) === normCenter &&
          normalizeArabic(item.branch) === normName;

        // Fetch matches from current state
        const matchingStudents = students.filter(s => matchesGeographically(s) && !!s.isArchived !== targetArchiveState);
        const matchingSessions = sessions.filter(s => matchesGeographically(s) && !!s.isArchived !== targetArchiveState);
        const matchingCoordinators = coordinators.filter(c => matchesGeographically(c) && !!c.isArchived !== targetArchiveState);
        const matchingMohfezs = mohfezs.filter(m => matchesGeographically(m) && !!m.isArchived !== targetArchiveState);

        // Fire API calls
        matchingStudents.forEach(s => studentsAPI.update(s.id, { isArchived: targetArchiveState }).catch(err => console.error(err)));
        matchingSessions.forEach(s => sessionsAPI.update(s.id, { isArchived: targetArchiveState }).catch(err => console.error(err)));
        matchingCoordinators.forEach(c => coordinatorsAPI.update(c.id, { isArchived: targetArchiveState }).catch(err => console.error(err)));
        matchingMohfezs.forEach(m => mohfezsAPI.update(m.id, { isArchived: targetArchiveState }).catch(err => console.error(err)));

        // Update states
        if (matchingStudents.length > 0) {
          setStudents(prev => prev.map(s => matchesGeographically(s) ? { ...s, isArchived: targetArchiveState } : s));
        }
        if (matchingSessions.length > 0) {
          setSessions(prev => prev.map(s => matchesGeographically(s) ? { ...s, isArchived: targetArchiveState } : s));
        }
        if (matchingCoordinators.length > 0) {
          setCoordinators(prev => prev.map(c => matchesGeographically(c) ? { ...c, isArchived: targetArchiveState } : c));
        }
        if (matchingMohfezs.length > 0) {
          setMohfezs(prev => prev.map(m => matchesGeographically(m) ? { ...m, isArchived: targetArchiveState } : m));
        }
      }
    }
  };
  const deleteBranch = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setBranches(prev => prev.filter(b => String(b.id) !== String(id)));
      branchesAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addFollowUpReport = (report) => {
    let finalReport = { ...report };
    let isUpdate = false;
    setFollowUpReports(prev => {
      const existsIndex = prev.findIndex(r => String(r.monthlyReportId) === String(report.monthlyReportId) && String(r.branchVisitId) === String(report.branchVisitId));
      if (existsIndex > -1) {
        isUpdate = true;
        finalReport.id = prev[existsIndex].id;
        const next = [...prev];
        next[existsIndex] = { ...next[existsIndex], ...report };
        return next;
      }
      finalReport.id = String(Date.now() + Math.random());
      return [...prev, finalReport];
    });
    if (isUpdate) followUpReportsAPI.update(finalReport.id, finalReport).catch(err => console.error(err));
    else followUpReportsAPI.create(finalReport).catch(err => console.error(err));
  };

  const confirmFollowUpReport = (monthlyReportId, branchVisitId, fileName) => {
    let updatedReport = null;
    setFollowUpReports(prev => {
      return prev.map(r => {
        if (String(r.monthlyReportId) === String(monthlyReportId) && String(r.branchVisitId) === String(branchVisitId)) {
          updatedReport = { ...r, isConfirmed: true, confirmationFile: fileName };
          return updatedReport;
        }
        return r;
      });
    });
    if (updatedReport) followUpReportsAPI.update(updatedReport.id, updatedReport).catch(err => console.error(err));
  };

  const addCoordinator = (coordinator) => {
    const newCoordinator = { ...coordinator, id: String(Date.now() + Math.random()) };
    setCoordinators(prev => [...prev, newCoordinator]);
    coordinatorsAPI.create(newCoordinator).catch(err => console.error(err));
  };
  const updateCoordinator = (id, updatedCoordinator) => {
    let resolvedIsArchived = undefined;
    const current = coordinators.find(c => String(c.id) === String(id));
    const oldNid = current ? String(current.national_id || '').trim() : '';
    const newNid = String(updatedCoordinator.national_id || '').trim();

    if (current) {
      resolvedIsArchived = updatedCoordinator.isArchived !== undefined ? updatedCoordinator.isArchived : current.isArchived;
      if (updatedCoordinator.admin !== undefined || updatedCoordinator.center !== undefined || updatedCoordinator.branch !== undefined) {
        const finalAdmin = updatedCoordinator.admin !== undefined ? updatedCoordinator.admin : current.admin;
        const finalCenter = updatedCoordinator.center !== undefined ? updatedCoordinator.center : current.center;
        const finalBranch = updatedCoordinator.branch !== undefined ? updatedCoordinator.branch : current.branch;
        const targetBranch = branches.find(b => 
          normalizeArabic(b.admin) === normalizeArabic(finalAdmin) &&
          normalizeArabic(b.center) === normalizeArabic(finalCenter) &&
          normalizeArabic(b.name) === normalizeArabic(finalBranch)
        );
        if (targetBranch && !targetBranch.isArchived) {
          resolvedIsArchived = false;
        }
      }
    }
    const payload = resolvedIsArchived !== undefined 
      ? { ...updatedCoordinator, isArchived: resolvedIsArchived }
      : updatedCoordinator;
    setCoordinators(prev => prev.map(c => String(c.id) === String(id) ? { ...c, ...payload } : c));
    coordinatorsAPI.update(id, payload).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deleteCoordinator = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = coordinators.find(c => String(c.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setCoordinators(prev => prev.filter(c => String(c.id) !== String(id)));
      coordinatorsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addMohfez = (mohfez) => {
    const newMohfez = { ...mohfez, id: String(Date.now() + Math.random()) };
    setMohfezs(prev => [...prev, newMohfez]);
    mohfezsAPI.create(newMohfez).catch(err => console.error(err));
  };
  const updateMohfez = (id, updatedMohfez) => {
    let resolvedIsArchived = undefined;
    const current = mohfezs.find(m => String(m.id) === String(id));
    const oldNid = current ? String(current.national_id || '').trim() : '';
    const newNid = String(updatedMohfez.national_id || '').trim();

    if (current) {
      resolvedIsArchived = updatedMohfez.isArchived !== undefined ? updatedMohfez.isArchived : current.isArchived;
      if (updatedMohfez.admin !== undefined || updatedMohfez.center !== undefined || updatedMohfez.branch !== undefined) {
        const finalAdmin = updatedMohfez.admin !== undefined ? updatedMohfez.admin : current.admin;
        const finalCenter = updatedMohfez.center !== undefined ? updatedMohfez.center : current.center;
        const finalBranch = updatedMohfez.branch !== undefined ? updatedMohfez.branch : current.branch;
        const targetBranch = branches.find(b => 
          normalizeArabic(b.admin) === normalizeArabic(finalAdmin) &&
          normalizeArabic(b.center) === normalizeArabic(finalCenter) &&
          normalizeArabic(b.name) === normalizeArabic(finalBranch)
        );
        if (targetBranch && !targetBranch.isArchived) {
          resolvedIsArchived = false;
        }
      }
    }
    const payload = resolvedIsArchived !== undefined 
      ? { ...updatedMohfez, isArchived: resolvedIsArchived }
      : updatedMohfez;
    setMohfezs(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...payload } : m));
    mohfezsAPI.update(id, payload).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deleteMohfez = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = mohfezs.find(m => String(m.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setMohfezs(prev => prev.filter(m => String(m.id) !== String(id)));
      mohfezsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addSession = (session) => {
    const newSession = { ...session, id: String(Date.now() + Math.random()) };
    setSessions(prev => [...prev, newSession]);
    sessionsAPI.create(newSession).catch(err => console.error(err));
  };
  const updateSession = (id, updatedSession) => {
    let resolvedIsArchived = undefined;
    const current = sessions.find(s => String(s.id) === String(id));
    if (current) {
      resolvedIsArchived = updatedSession.isArchived !== undefined ? updatedSession.isArchived : current.isArchived;
      if (updatedSession.admin !== undefined || updatedSession.center !== undefined || updatedSession.branch !== undefined) {
        const finalAdmin = updatedSession.admin !== undefined ? updatedSession.admin : current.admin;
        const finalCenter = updatedSession.center !== undefined ? updatedSession.center : current.center;
        const finalBranch = updatedSession.branch !== undefined ? updatedSession.branch : current.branch;
        const targetBranch = branches.find(b => 
          normalizeArabic(b.admin) === normalizeArabic(finalAdmin) &&
          normalizeArabic(b.center) === normalizeArabic(finalCenter) &&
          normalizeArabic(b.name) === normalizeArabic(finalBranch)
        );
        if (targetBranch && !targetBranch.isArchived) {
          resolvedIsArchived = false;
        }
      }
    }
    const payload = resolvedIsArchived !== undefined 
      ? { ...updatedSession, isArchived: resolvedIsArchived }
      : updatedSession;
    setSessions(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...payload } : s));
    sessionsAPI.update(id, payload).catch(err => console.error(err));
  };
  const deleteSession = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setSessions(prev => prev.filter(s => String(s.id) !== String(id)));
      sessionsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addStudent = (student) => {
    const newStudent = { ...student, id: String(Date.now() + Math.random()) };
    setStudents(prev => [...prev, newStudent]);
    studentsAPI.create(newStudent).catch(err => console.error(err));
  };
  const updateStudent = (id, updatedStudent) => {
    let resolvedIsArchived = undefined;
    const current = students.find(s => String(s.id) === String(id));
    const oldNid = current ? String(current.national_id || '').trim() : '';
    const newNid = String(updatedStudent.national_id || '').trim();

    if (current) {
      resolvedIsArchived = updatedStudent.isArchived !== undefined ? updatedStudent.isArchived : current.isArchived;
      if (updatedStudent.admin !== undefined || updatedStudent.center !== undefined || updatedStudent.branch !== undefined) {
        const finalAdmin = updatedStudent.admin !== undefined ? updatedStudent.admin : current.admin;
        const finalCenter = updatedStudent.center !== undefined ? updatedStudent.center : current.center;
        const finalBranch = updatedStudent.branch !== undefined ? updatedStudent.branch : current.branch;
        const targetBranch = branches.find(b => 
          normalizeArabic(b.admin) === normalizeArabic(finalAdmin) &&
          normalizeArabic(b.center) === normalizeArabic(finalCenter) &&
          normalizeArabic(b.name) === normalizeArabic(finalBranch)
        );
        if (targetBranch && !targetBranch.isArchived) {
          resolvedIsArchived = false;
        }
      }
    }
    const payload = resolvedIsArchived !== undefined 
      ? { ...updatedStudent, isArchived: resolvedIsArchived }
      : updatedStudent;
    setStudents(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...payload } : s));
    studentsAPI.update(id, payload).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deleteStudent = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = students.find(s => String(s.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setStudents(prev => prev.filter(s => String(s.id) !== String(id)));
      studentsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const bulkImportStudents = async (studentList, userList) => {
    const newStudents = studentList.map(s => ({
      ...s,
      id: s.id || String(Date.now() + Math.random())
    }));
    
    try {
      await studentsAPI.bulkImport(newStudents);
    } catch (err) {
      console.error('Failed to bulk import students to DB:', err);
      alert('فشل حفظ الطلاب في قاعدة البيانات: ' + err.message);
      throw err;
    }

    setStudents(prev => [...prev, ...newStudents]);
    const savedStudents = getFromLocalStorage('students', []);
    saveToLocalStorage('students', [...savedStudents, ...newStudents]);

    if (userList && userList.length > 0) {
      const newUsers = userList.map(u => ({
        ...u,
        id: u.id || String(Date.now() + Math.random()),
        created_at: new Date().toLocaleDateString('ar-EG')
      }));
      try {
        await usersAPI.bulkImport(newUsers);
      } catch (err) {
        console.error('Failed to bulk import users to DB:', err);
        alert('تنبيه: فشل حفظ بعض حسابات الدخول للطلاب في قاعدة البيانات: ' + err.message);
      }
      setUsers(prev => {
        const uniqueUsers = [...prev];
        newUsers.forEach(nu => {
          if (!uniqueUsers.some(u => String(u.national_id).trim() === String(nu.national_id).trim())) {
            uniqueUsers.push(nu);
          }
        });
        saveToLocalStorage('users', uniqueUsers);
        return uniqueUsers;
      });
    }
  };

  const addApplicant = (applicant) => {
    const newApplicant = { ...applicant, id: String(Date.now() + Math.random()), register_date: new Date().toLocaleDateString('en-GB') };
    setApplicants(prev => [...prev, newApplicant]);
    applicantsAPI.create(newApplicant).catch(err => console.error(err));
  };
  const updateApplicant = (id, updatedApplicant) => {
    setApplicants(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...updatedApplicant } : a));
    applicantsAPI.update(id, updatedApplicant).catch(err => console.error(err));
  };
  const deleteApplicant = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setApplicants(prev => prev.filter(a => String(a.id) !== String(id)));
      applicantsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addRowaq = (rowaq) => {
    const newRowaq = { ...rowaq, id: String(Date.now() + Math.random()), levels: parseInt(rowaq.levels) || 0, created_at: new Date().toISOString().split('T')[0] };
    setRowaqs(prev => [...prev, newRowaq]);
    rowaqsAPI.create(newRowaq).catch(err => console.error(err));
  };
  const updateRowaq = (id, updatedRowaq) => {
    setRowaqs(prev => prev.map(r => String(r.id) === String(id) ? { ...r, ...updatedRowaq, levels: parseInt(updatedRowaq.levels) || 0 } : r));
    rowaqsAPI.update(id, updatedRowaq).catch(err => console.error(err));
  };
  const deleteRowaq = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setRowaqs(prev => prev.filter(r => String(r.id) !== String(id)));
      rowaqsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const deleteUser = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setUsers(prev => {
        const next = prev.filter(u => String(u.id) !== String(id));
        saveToLocalStorage('users', next);
        return next;
      });
      usersAPI.delete(id).catch(err => console.error(err));
    }
  };

  const deleteUserByNationalId = (nationalId) => {
    if (!nationalId) return;
    const nid = String(nationalId).trim();
    setUsers(prev => {
      const user = prev.find(u => String(u.national_id || u.username || '').trim() === nid);
      if (user) {
        usersAPI.delete(user.id || user._id).catch(err => console.error(err));
        const next = prev.filter(u => String(u.id) !== String(user.id));
        saveToLocalStorage('users', next);
        return next;
      }
      return prev;
    });
  };

  // مزامنة تعديل الرقم القومي بين المستخدمين users ومختلف جهات المنصة في الاتجاهين
  const syncNationalIdChange = (oldNidRaw, newNidRaw, source = 'entity') => {
    const oldNid = String(oldNidRaw || '').trim();
    const newNid = String(newNidRaw || '').trim();
    if (!oldNid || !newNid || oldNid === newNid) return;

    if (source === 'entity') {
      // 1. التعديل تم من جهة المنصة (دارس، متقدم، محفظ، منسق، مشرف) -> حدِّث جدول المستخدمين
      setUsers(prev => {
        let matched = false;
        const next = prev.map(u => {
          const uNid = String(u.national_id || '').trim();
          const uUser = String(u.username || '').trim();
          const uEmail = String(u.email || '').trim();
          if (uNid === oldNid || uUser === oldNid || uEmail === oldNid) {
            matched = true;
            const updatedU = {
              ...u,
              national_id: newNid,
              username: (uUser === oldNid || !uUser) ? newNid : uUser,
              email: (uEmail === oldNid || !uEmail) ? newNid : uEmail,
              password: (String(u.password || '').trim() === oldNid || !u.password) ? newNid : u.password,
              record_number: (String(u.record_number || '').trim() === oldNid || !u.record_number) ? newNid : u.record_number,
            };
            const targetId = u.id || u._id || oldNid;
            usersAPI.update(targetId, updatedU).catch(err => console.error('Failed to sync user national_id:', err));
            return updatedU;
          }
          return u;
        });
        if (matched) {
          saveToLocalStorage('users', next);
        }
        return next;
      });
    } else if (source === 'user') {
      // 2. التعديل تم من جدول المستخدمين -> حدِّث جميع سجلات المنصة المتطابقة مع الرقم القومي القديم
      // أ) دارسو المنصة platformStudents
      setPlatformStudents(prev => {
        let modified = false;
        const next = prev.map(s => {
          const sNid = String(s.national_id || s.passport_no || '').trim();
          if (sNid === oldNid) {
            modified = true;
            const updatedS = { ...s, national_id: newNid, passport_no: newNid };
            platformStudentsAPI.update(s.id || s._id, updatedS).catch(err => console.error('Failed to sync platformStudent nid:', err));
            return updatedS;
          }
          return s;
        });
        if (modified) saveToLocalStorage('platformStudents', next);
        return next;
      });

      // ب) المتقدمون الجدد platformApplicants
      setPlatformApplicants(prev => {
        let modified = false;
        const next = prev.map(a => {
          const aNid = String(a.national_id || a.passport_no || '').trim();
          if (aNid === oldNid) {
            modified = true;
            const updatedA = { ...a, national_id: newNid, passport_no: newNid };
            platformApplicantsAPI.update(a._id || a.id, updatedA).catch(err => console.error('Failed to sync applicant nid:', err));
            return updatedA;
          }
          return a;
        });
        if (modified) saveToLocalStorage('platformApplicants', next);
        return next;
      });

      // ج) محفظو المنصة platformMohfezs
      setPlatformMohfezs(prev => {
        let modified = false;
        const next = prev.map(m => {
          if (String(m.national_id || '').trim() === oldNid) {
            modified = true;
            const updatedM = { ...m, national_id: newNid };
            platformMohfezsAPI.update(m.id || m._id, updatedM).catch(err => console.error(err));
            return updatedM;
          }
          return m;
        });
        if (modified) saveToLocalStorage('platformMohfezs', next);
        return next;
      });

      // د) منسقو المنصة platformCoordinators
      setPlatformCoordinators(prev => {
        let modified = false;
        const next = prev.map(c => {
          if (String(c.national_id || '').trim() === oldNid) {
            modified = true;
            const updatedC = { ...c, national_id: newNid };
            platformCoordinatorsAPI.update(c.id || c._id, updatedC).catch(err => console.error(err));
            return updatedC;
          }
          return c;
        });
        if (modified) saveToLocalStorage('platformCoordinators', next);
        return next;
      });

      // هـ) مشرفو المنصة platformSupervisors
      setPlatformSupervisors(prev => {
        let modified = false;
        const next = prev.map(s => {
          if (String(s.national_id || '').trim() === oldNid) {
            modified = true;
            const updatedS = { ...s, national_id: newNid };
            platformSupervisorsAPI.update(s.id || s._id, updatedS).catch(err => console.error(err));
            return updatedS;
          }
          return s;
        });
        if (modified) saveToLocalStorage('platformSupervisors', next);
        return next;
      });

      // و) الدارسون students
      setStudents(prev => {
        let modified = false;
        const next = prev.map(s => {
          if (String(s.national_id || '').trim() === oldNid) {
            modified = true;
            const updatedS = { ...s, national_id: newNid };
            studentsAPI.update(s.id || s._id, updatedS).catch(err => console.error(err));
            return updatedS;
          }
          return s;
        });
        if (modified) saveToLocalStorage('students', next);
        return next;
      });

      // ز) المحفظون mohfezs
      setMohfezs(prev => {
        let modified = false;
        const next = prev.map(m => {
          if (String(m.national_id || '').trim() === oldNid) {
            modified = true;
            const updatedM = { ...m, national_id: newNid };
            mohfezsAPI.update(m.id || m._id, updatedM).catch(err => console.error(err));
            return updatedM;
          }
          return m;
        });
        if (modified) saveToLocalStorage('mohfezs', next);
        return next;
      });

      // ح) المنسقون coordinators
      setCoordinators(prev => {
        let modified = false;
        const next = prev.map(c => {
          if (String(c.national_id || '').trim() === oldNid) {
            modified = true;
            const updatedC = { ...c, national_id: newNid };
            coordinatorsAPI.update(c.id || c._id, updatedC).catch(err => console.error(err));
            return updatedC;
          }
          return c;
        });
        if (modified) saveToLocalStorage('coordinators', next);
        return next;
      });
    }
  };

  const normalizeUserFields = (user) => {
    const isAdminRole = user.role === 'admin';
    if (isAdminRole) {
      return {
        ...user,
        username: 'admin',
        email: 'admin',
        national_id: 'admin',
        record_number: 'admin',
        password: user.password || user.record_number || '',
      };
    }
    return {
      ...user,
      username: user.username || user.national_id || user.email || '',
      email: user.email || user.national_id || '',
      password: user.password || user.record_number || '',
      record_number: user.record_number || user.password || '',
    };
  };

  const addUser = (user) => {
    const normalizedUser = {
      ...normalizeUserFields(user),
      id: user.id || String(Date.now() + Math.random()),
      created_at: new Date().toLocaleDateString('ar-EG')
    };
    try {
      const stored = JSON.parse(localStorage.getItem('users') || '[]');
      const nid = String(normalizedUser.national_id || '').trim();
      if (!nid || !stored.some(u => String(u.national_id || '').trim() === nid && nid !== '')) {
        stored.push(normalizedUser);
        localStorage.setItem('users', JSON.stringify(stored));
      }
    } catch (e) { console.error(e); }
    setUsers(prev => {
      const nid = String(normalizedUser.national_id || '').trim();
      if (nid && prev.some(u => String(u.national_id || '').trim() === nid)) return prev;
      return [...prev, normalizedUser];
    });
    usersAPI.create(normalizedUser).catch(err => console.error(err));
  };

  const updateUser = (id, updatedUser) => {
    const existingUser = users.find(u => String(u.id) === String(id) || String(u._id) === String(id));
    const oldNid = existingUser ? String(existingUser.national_id || existingUser.username || existingUser.email || '').trim() : '';
    const newNid = String(updatedUser.national_id || updatedUser.username || '').trim();

    const mergeAndNormalize = (u) => {
      const merged = { ...u, ...updatedUser };
      const isAdminRole = merged.role === 'admin';
      if (isAdminRole) {
        // الباسورد الجديد يأتي من updatedUser.password — نحفظه في كلا الحقلين
        const newPass = updatedUser.password || merged.password || merged.record_number || '';
        return {
          ...merged,
          username: 'admin',
          email: 'admin',
          national_id: 'admin',
          password: newPass,
          record_number: newPass, // ← نحفظ الباسورد الجديد هنا أيضاً (ليس 'admin')
        };
      }
      return {
        ...merged,
        username: merged.national_id || merged.email || merged.username || '',
        email: merged.email || merged.national_id || '',
        password: merged.password || merged.record_number || '',
        record_number: merged.record_number || merged.password || '',
      };
    };
    let payload = null;
    setUsers(prev => prev.map(u => {
      if (String(u.id) === String(id) || (u._id && String(u._id) === String(id))) {
        payload = mergeAndNormalize(u);
        return payload;
      }
      return u;
    }));
    try {
      const stored = JSON.parse(localStorage.getItem('users') || '[]');
      const updated = stored.map(u => (String(u.id) === String(id) || (u._id && String(u._id) === String(id))) ? mergeAndNormalize(u) : u);
      localStorage.setItem('users', JSON.stringify(updated));
    } catch (e) { console.error(e); }
    if (payload) {
      const isAdminPayload = payload.role === 'admin' || payload.username === 'admin' || payload.national_id === 'admin';
      if (isAdminPayload) {
        // للأدمن: استخدم 'admin' كمعرّف — الـ API سيبحث بالـ username تلقائياً
        // هذا أبسط وأكثر موثوقية من استخدام MongoDB _id
        (async () => {
          try {
            await usersAPI.update('admin', payload);
            console.log('\u2705 Admin password updated in MongoDB successfully');
          } catch (err) {
            // إذا فشل التحديث (الأدمن غير موجود) — أنشئه
            try {
              await usersAPI.create(payload);
              console.log('\u2705 Admin created in MongoDB with new password');
            } catch (createErr) {
              console.error('\u274C Admin sync to MongoDB failed:', createErr);
            }
          }
        })();
      } else {
        // للمستخدمين العاديين: استخدم الـ _id أو id
        const targetApiId = existingUser?._id || existingUser?.id || id;
        usersAPI.update(targetApiId, payload).catch(err => console.error(err));
      }
    }

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'user');
    }
  };

  const addApplicantBranch = (item) => {
    const newItem = { ...item, id: String(Date.now()) };
    setApplicantBranches(prev => [...prev, newItem]);
    applicantBranchesAPI.create(newItem).catch(err => console.error(err));
  };
  const updateApplicantBranch = (id, updatedItem) => {
    setApplicantBranches(prev => prev.map(b => String(b.id) === String(id) ? { ...b, ...updatedItem } : b));
    applicantBranchesAPI.update(id, updatedItem).catch(err => console.error(err));
  };
  const deleteApplicantBranch = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setApplicantBranches(prev => prev.filter(b => String(b.id) !== String(id)));
      applicantBranchesAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addAttendance = (attendance) => {
    const newAttendance = { ...attendance, id: String(Date.now()) };
    setAttendances(prev => [...prev, newAttendance]);
    attendancesAPI.create(newAttendance).catch(err => console.error(err));
  };
  const deleteAttendance = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setAttendances(prev => prev.filter(a => String(a.id) !== String(id)));
      attendancesAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addSessionReport = (report) => {
    const newReport = { ...report, id: String(Date.now()) };
    setSessionReports(prev => [...prev, newReport]);
    sessionReportsAPI.create(newReport).catch(err => console.error(err));
  };
  const deleteSessionReport = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setSessionReports(prev => prev.filter(r => String(r.id) !== String(id)));
      sessionReportsAPI.delete(id).catch(err => console.error(err));
    }
  };

  // ───────── الإجازات / الإعلانات / الردود / حضور الكادر / بيانات المنصة ─────────
  useEffect(() => { saveToLocalStorage('holidays', holidays); }, [holidays]);
  useEffect(() => { saveToLocalStorage('announcements', announcements); }, [announcements]);
  useEffect(() => { saveToLocalStorage('announcementReplies', announcementReplies); }, [announcementReplies]);
  useEffect(() => { saveToLocalStorage('staffAttendances', staffAttendances); }, [staffAttendances]);
  useEffect(() => { saveToLocalStorage('substitutions', substitutions); }, [substitutions]);
  useEffect(() => { saveToLocalStorage('placementGroups', placementGroups); }, [placementGroups]);
  useEffect(() => { saveToLocalStorage('platformTopManagement', platformTopManagement); }, [platformTopManagement]);
  useEffect(() => { saveToLocalStorage('platformSupervisors', platformSupervisors); }, [platformSupervisors]);
  useEffect(() => { saveToLocalStorage('platformCoordinators', platformCoordinators); }, [platformCoordinators]);
  useEffect(() => { saveToLocalStorage('platformMohfezs', platformMohfezs); }, [platformMohfezs]);
  useEffect(() => { saveToLocalStorage('platformSessions', platformSessions); }, [platformSessions]);
  useEffect(() => { saveToLocalStorage('platformStudents', platformStudents); }, [platformStudents]);
  useEffect(() => { saveToLocalStorage('platformApplicants', platformApplicants); }, [platformApplicants]);
  useEffect(() => { saveToLocalStorage('platformRowaqs', platformRowaqs); }, [platformRowaqs]);

  // مزامنة فورية ودورية لبيانات المتقدمين الجدد ومجموعات تحديد المستوى بين جميع الأجهزة
  useEffect(() => {
    const syncApplicantsFromRemote = async () => {
      if (pendingApplicantOpsRef.current > 0) return;
      const [remoteApps, remotePG] = await Promise.all([
        platformApplicantsAPI.getAll().catch(() => null),
        placementGroupsAPI.getAll().catch(() => null),
      ]);
      if (pendingApplicantOpsRef.current > 0) return;

      if (Array.isArray(remoteApps)) {
        const deletedSet = deletedApplicantIdsRef.current;
        const normApps = remoteApps
          .map(item => {
            const norm = {
              ...item,
              id: item.id || item._id,
              exam_date: item.exam_date ? normalizeExamDate(item.exam_date) : '',
              exam_time: item.exam_time ? normalizeExamTime(item.exam_time) : ''
            };
            return rescheduleApplicantDay9(norm);
          })
          .filter(item => {
            if (deletedSet.has(String(item.id))) return false;
            if (item._id && deletedSet.has(String(item._id))) return false;
            const nid = String(item.national_id || item.passport_no || '').trim();
            if (nid && deletedSet.has(nid)) return false;
            return true;
          });
        setPlatformApplicants(normApps);
        saveToLocalStorage('platformApplicants', normApps);
      }

      if (Array.isArray(remotePG) && remotePG.length > 0) {
        const normPG = remotePG
          .map(g => ({ ...g, id: g.id || g._id }))
          .sort((a, b) => (Number(a.group_no) || 0) - (Number(b.group_no) || 0));
        setPlacementGroups(normPG);
        saveToLocalStorage('placementGroups', normPG);
      }
    };

    const intervalId = setInterval(syncApplicantsFromRemote, 10000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncApplicantsFromRemote();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  const updatePlacementGroup = (id, updatedData) => {
    const targetGroup = placementGroups.find(g => String(g.id) === String(id) || String(g._id) === String(id) || String(g.group_no) === String(id));
    const remoteId = targetGroup?._id || targetGroup?.id || id;
    setPlacementGroups(prev => {
      const next = prev.map(g =>
        (String(g.id) === String(id) || String(g._id) === String(id) || (targetGroup && Number(g.group_no) === Number(targetGroup.group_no)))
          ? { ...g, ...updatedData }
          : g
      );
      saveToLocalStorage('placementGroups', next);
      return next;
    });
    pendingApplicantOpsRef.current += 1;
    placementGroupsAPI.update(remoteId, updatedData)
      .catch(err => console.error(err))
      .finally(() => {
        pendingApplicantOpsRef.current = Math.max(0, pendingApplicantOpsRef.current - 1);
      });
  };

  // تعيين محفظ بديل لحلقة في يوم محدد (يستبدل أي بديل سابق لنفس الحلقة واليوم)
  const addSubstitution = (sub) => {
    const day = String(sub.date || '').replace(/\//g, '-');
    const old = substitutions.filter(s => String(s.sessionId) === String(sub.sessionId) && String(s.date).replace(/\//g, '-') === day);
    old.forEach(o => substitutionsAPI.delete(o.id).catch(err => console.error(err)));
    const newItem = { ...sub, date: day, id: String(Date.now()), createdAt: new Date().toISOString() };
    setSubstitutions(prev => [...prev.filter(s => !old.some(o => o.id === s.id)), newItem]);
    substitutionsAPI.create(newItem).catch(err => console.error(err));
  };
  const deleteSubstitution = (id) => {
    setSubstitutions(prev => prev.filter(s => String(s.id) !== String(id)));
    substitutionsAPI.delete(id).catch(err => console.error(err));
  };

  // تحديث دوري للإعلانات والردود ليصل الإشعار دون إعادة تحميل الصفحة
  useEffect(() => {
    const norm = (list) => list.map(item => ({ ...item, id: item.id || item._id }));
    const poll = async () => {
      const [anns, reps] = await Promise.all([
        announcementsAPI.getAll().catch(() => null),
        announcementRepliesAPI.getAll().catch(() => null),
      ]);
      if (Array.isArray(anns)) setAnnouncements(norm(anns));
      if (Array.isArray(reps)) setAnnouncementReplies(norm(reps));
    };
    const t = setInterval(poll, 60000);
    return () => clearInterval(t);
  }, []);

  const addHoliday = (holiday) => {
    const newItem = { ...holiday, id: String(Date.now()) };
    setHolidays(prev => [...prev, newItem]);
    holidaysAPI.create(newItem).catch(err => console.error(err));
  };
  const deleteHoliday = (id) => {
    if (window.confirm('هل أنت متأكد من حذف الإجازة؟')) {
      setHolidays(prev => prev.filter(h => String(h.id) !== String(id)));
      holidaysAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addAnnouncement = (announcement) => {
    const newItem = { ...announcement, id: String(Date.now()), createdAt: new Date().toISOString() };
    setAnnouncements(prev => [newItem, ...prev]);
    announcementsAPI.create(newItem).catch(err => console.error(err));
  };
  const deleteAnnouncement = (id) => {
    if (window.confirm('هل أنت متأكد من حذف الإعلان وجميع الردود عليه؟')) {
      setAnnouncements(prev => prev.filter(a => String(a.id) !== String(id)));
      announcementsAPI.delete(id).catch(err => console.error(err));
      announcementReplies
        .filter(r => String(r.announcementId) === String(id))
        .forEach(r => announcementRepliesAPI.delete(r.id).catch(err => console.error(err)));
      setAnnouncementReplies(prev => prev.filter(r => String(r.announcementId) !== String(id)));
    }
  };
  const addAnnouncementReply = (reply) => {
    const newItem = { ...reply, id: String(Date.now()), createdAt: new Date().toISOString(), readByAdmin: false };
    setAnnouncementReplies(prev => [...prev, newItem]);
    announcementRepliesAPI.create(newItem).catch(err => console.error(err));
  };
  const markAnnouncementRepliesRead = (ids) => {
    const set = new Set(ids.map(String));
    if (set.size === 0) return;
    setAnnouncementReplies(prev => prev.map(r => set.has(String(r.id)) ? { ...r, readByAdmin: true } : r));
    ids.forEach(id => announcementRepliesAPI.update(id, { readByAdmin: true }).catch(err => console.error(err)));
  };

  const updateAttendance = (id, data) => {
    setAttendances(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...data } : a));
    attendancesAPI.update(id, data).catch(err => console.error(err));
  };

  /**
   * تسجيل حضور تلقائي بمجرد الدخول على رابط الانضمام للحلقة
   * - الدارس: يُسجَّل حاضراً في سجل غياب اليوم
   * - المحفظ / المنسق: يُسجَّل في سجل حضور الكادر
   */
  const recordSessionJoin = (session, user) => {
    if (!session || !user) return;
    const role = user.role;
    const today = toLocalDateStr();
    const todaySlash = today.replace(/-/g, '/');

    if (role === 'student') {
      const studentRec = findStudentRecord(user, platformStudents);
      if (!studentRec) return;
      const existing = attendances.find(a =>
        String(a.sessionId) === String(session.id) && !!a.isPlatform &&
        String(a.date || '').replace(/\//g, '-') === today
      );
      if (existing) {
        const records = [...(existing.records || [])];
        const idx = records.findIndex(r => String(r.studentId) === String(studentRec.id));
        if (idx >= 0) {
          if (records[idx].isPresent) return;
          records[idx] = { ...records[idx], isPresent: true, joinedAt: new Date().toISOString() };
        } else {
          records.push({ studentId: studentRec.id, studentName: studentRec.name, isPresent: true, joinedAt: new Date().toISOString() });
        }
        const presentCount = records.filter(r => r.isPresent).length;
        updateAttendance(existing.id, { records, presentCount, absentCount: records.length - presentCount });
      } else {
        const sessionStudents = getStudentsOfSession(session, platformStudents);
        if (!sessionStudents.some(s => String(s.id) === String(studentRec.id))) sessionStudents.push(studentRec);
        const records = sessionStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          isPresent: String(s.id) === String(studentRec.id),
          ...(String(s.id) === String(studentRec.id) ? { joinedAt: new Date().toISOString() } : {})
        }));
        const presentCount = records.filter(r => r.isPresent).length;
        addAttendance({
          sessionId: String(session.id), isPlatform: true, date: todaySlash,
          presentCount, absentCount: records.length - presentCount, records, auto: true
        });
      }
      return;
    }

    if (role === 'platform_mohfez' || role === 'platform_coordinator') {
      const nid = String(user.national_id || user.username || '').trim();
      const already = staffAttendances.some(s =>
        String(s.sessionId) === String(session.id) && s.date === today &&
        String(s.nationalId) === nid && s.role === role
      );
      if (already) return;
      const entry = {
        id: String(Date.now()), sessionId: String(session.id), sessionNo: session.session_no,
        date: today, role, nationalId: nid, name: user.name || '', joinedAt: new Date().toISOString()
      };
      setStaffAttendances(prev => [...prev, entry]);
      staffAttendancesAPI.create(entry).catch(err => console.error(err));
    }
  };

  const addPlatformTopManagement = (item) => {
    const newItem = { ...item, id: String(Date.now()) };
    setPlatformTopManagement(prev => [...prev, newItem]);
    platformTopManagementAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformTopManagement = (id, updatedItem) => {
    const existing = platformTopManagement.find(m => String(m.id) === String(id) || String(m._id) === String(id));
    const oldNid = existing ? String(existing.national_id || '').trim() : '';
    const newNid = String(updatedItem.national_id || '').trim();

    setPlatformTopManagement(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedItem } : m));
    platformTopManagementAPI.update(id, updatedItem).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deletePlatformTopManagement = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = platformTopManagement.find(m => String(m.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setPlatformTopManagement(prev => prev.filter(m => String(m.id) !== String(id)));
      platformTopManagementAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addPlatformSupervisor = (item) => {
    const newItem = { ...item, id: String(Date.now()) };
    setPlatformSupervisors(prev => [...prev, newItem]);
    platformSupervisorsAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformSupervisor = (id, updatedItem) => {
    const existing = platformSupervisors.find(m => String(m.id) === String(id) || String(m._id) === String(id));
    const oldNid = existing ? String(existing.national_id || '').trim() : '';
    const newNid = String(updatedItem.national_id || '').trim();

    setPlatformSupervisors(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedItem } : m));
    platformSupervisorsAPI.update(id, updatedItem).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deletePlatformSupervisor = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = platformSupervisors.find(m => String(m.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setPlatformSupervisors(prev => prev.filter(m => String(m.id) !== String(id)));
      platformSupervisorsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addPlatformCoordinator = (item) => {
    const newItem = { ...item, id: item.id || String(Date.now() + Math.random()) };
    setPlatformCoordinators(prev => [...prev, newItem]);
    platformCoordinatorsAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformCoordinator = (id, updatedItem) => {
    const existing = platformCoordinators.find(m => String(m.id) === String(id) || String(m._id) === String(id));
    const oldNid = existing ? String(existing.national_id || '').trim() : '';
    const newNid = String(updatedItem.national_id || '').trim();

    setPlatformCoordinators(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedItem } : m));
    platformCoordinatorsAPI.update(id, updatedItem).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deletePlatformCoordinator = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = platformCoordinators.find(m => String(m.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setPlatformCoordinators(prev => prev.filter(m => String(m.id) !== String(id)));
      platformCoordinatorsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addPlatformMohfez = (item) => {
    const newItem = { ...item, id: item.id || String(Date.now() + Math.random()) };
    setPlatformMohfezs(prev => [...prev, newItem]);
    platformMohfezsAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformMohfez = (id, updatedItem) => {
    const existing = platformMohfezs.find(m => String(m.id) === String(id) || String(m._id) === String(id));
    const oldNid = existing ? String(existing.national_id || '').trim() : '';
    const newNid = String(updatedItem.national_id || '').trim();

    setPlatformMohfezs(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedItem } : m));
    platformMohfezsAPI.update(id, updatedItem).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deletePlatformMohfez = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = platformMohfezs.find(m => String(m.id) === String(id));
      if (item && item.national_id) deleteUserByNationalId(item.national_id);
      setPlatformMohfezs(prev => prev.filter(m => String(m.id) !== String(id)));
      platformMohfezsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addPlatformSession = (item) => {
    const newItem = { ...item, id: String(Date.now()) };
    setPlatformSessions(prev => [...prev, newItem]);
    platformSessionsAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformSession = (id, updatedItem) => {
    setPlatformSessions(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedItem } : m));
    platformSessionsAPI.update(id, updatedItem).catch(err => console.error(err));
  };
  const deletePlatformSession = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setPlatformSessions(prev => prev.filter(m => String(m.id) !== String(id)));
      platformSessionsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addPlatformStudent = (item) => {
    const newItem = { ...item, id: String(Date.now()) };
    setPlatformStudents(prev => [newItem, ...prev]);
    platformStudentsAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformStudent = (id, updatedItem) => {
    const existing = platformStudents.find(m => String(m.id) === String(id) || String(m._id) === String(id));
    const oldNid = existing ? String(existing.national_id || existing.passport_no || '').trim() : '';
    const newNid = String(updatedItem.national_id || updatedItem.passport_no || '').trim();

    setPlatformStudents(prev => prev.map(m => (String(m.id) === String(id) || String(m._id) === String(id)) ? { ...m, ...updatedItem } : m));
    platformStudentsAPI.update(id, updatedItem).catch(err => console.error(err));

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deletePlatformStudent = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = platformStudents.find(m => String(m.id) === String(id));
      if (item) deleteUserByNationalId(item.passport_no || item.national_id);
      setPlatformStudents(prev => prev.filter(m => String(m.id) !== String(id)));
      platformStudentsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const bulkImportPlatformStudents = async (studentList, userList) => {
    const newStudents = studentList.map(s => ({
      ...s,
      id: s.id || String(Date.now() + Math.random())
    }));
    
    try {
      await platformStudentsAPI.bulkImport(newStudents);
    } catch (err) {
      console.error('Failed platform students bulk import:', err);
      alert('فشل حفظ دارسي المنصة في قاعدة البيانات: ' + err.message);
      throw err;
    }

    setPlatformStudents(prev => [...prev, ...newStudents]);
    const saved = getFromLocalStorage('platformStudents', []);
    saveToLocalStorage('platformStudents', [...saved, ...newStudents]);

    if (userList && userList.length > 0) {
      const newUsers = userList.map(u => ({
        ...u,
        id: u.id || String(Date.now() + Math.random()),
        created_at: new Date().toLocaleDateString('ar-EG')
      }));
      try {
        await usersAPI.bulkImport(newUsers);
      } catch (err) {
        console.error('Failed bulk import users:', err);
        alert('تنبيه: فشل حفظ بعض حسابات الدخول لدارسي المنصة في قاعدة البيانات: ' + err.message);
      }
      setUsers(prev => {
        const uniqueUsers = [...prev];
        newUsers.forEach(nu => {
          if (!uniqueUsers.some(u => String(u.national_id).trim() === String(nu.national_id).trim())) {
            uniqueUsers.push(nu);
          }
        });
        saveToLocalStorage('users', uniqueUsers);
        return uniqueUsers;
      });
    }
  };

  const addPlatformApplicant = (item) => {
    const newItem = {
      ...item,
      id: String(Date.now()),
      exam_date: item.exam_date ? normalizeExamDate(item.exam_date) : '',
      exam_time: item.exam_time ? normalizeExamTime(item.exam_time) : ''
    };
    const nid = String(newItem.national_id || newItem.passport_no || '').trim();
    if (nid) deletedApplicantIdsRef.current.delete(nid);
    deletedApplicantIdsRef.current.delete(String(newItem.id));
    setPlatformApplicants(prev => {
      const next = [newItem, ...prev];
      saveToLocalStorage('platformApplicants', next);
      return next;
    });
    pendingApplicantOpsRef.current += 1;
    platformApplicantsAPI.create(newItem)
      .then(created => {
        if (created && created._id) {
          setPlatformApplicants(prev => {
            const next = prev.map(m => String(m.id) === String(newItem.id) ? { ...m, _id: created._id } : m);
            saveToLocalStorage('platformApplicants', next);
            return next;
          });
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        pendingApplicantOpsRef.current = Math.max(0, pendingApplicantOpsRef.current - 1);
      });
  };
  const updatePlatformApplicant = (id, updatedItem) => {
    const sanitizedItem = { ...updatedItem };
    if ('exam_date' in sanitizedItem && sanitizedItem.exam_date) {
      sanitizedItem.exam_date = normalizeExamDate(sanitizedItem.exam_date);
    }
    if ('exam_time' in sanitizedItem && sanitizedItem.exam_time) {
      sanitizedItem.exam_time = normalizeExamTime(sanitizedItem.exam_time);
    }
    const target = platformApplicants.find(m => String(m.id) === String(id) || String(m._id) === String(id));
    const remoteId = target?._id || id;
    const oldNid = target ? String(target.national_id || target.passport_no || '').trim() : '';
    const newNid = String(sanitizedItem.national_id || sanitizedItem.passport_no || '').trim();

    setPlatformApplicants(prev => {
      const next = prev.map(m => (String(m.id) === String(id) || String(m._id) === String(id)) ? { ...m, ...sanitizedItem } : m);
      saveToLocalStorage('platformApplicants', next);
      return next;
    });
    pendingApplicantOpsRef.current += 1;
    platformApplicantsAPI.update(remoteId, sanitizedItem)
      .catch(err => console.error(err))
      .finally(() => {
        pendingApplicantOpsRef.current = Math.max(0, pendingApplicantOpsRef.current - 1);
      });

    if (oldNid && newNid && oldNid !== newNid) {
      syncNationalIdChange(oldNid, newNid, 'entity');
    }
  };
  const deletePlatformApplicant = async (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const target = platformApplicants.find(m => String(m.id) === String(id) || String(m._id) === String(id));
      const targetNid = String(target?.national_id || target?.passport_no || '').trim();
      const idsToDelete = new Set([String(id)]);
      if (target?.id) idsToDelete.add(String(target.id));
      if (target?._id) idsToDelete.add(String(target._id));
      if (targetNid) idsToDelete.add(targetNid);

      idsToDelete.forEach(k => deletedApplicantIdsRef.current.add(k));

      setPlatformApplicants(prev => {
        const next = prev.filter(m => {
          if (String(m.id) === String(id)) return false;
          if (m._id && String(m._id) === String(id)) return false;
          if (target?._id && String(m._id) === String(target._id)) return false;
          if (targetNid && String(m.national_id || m.passport_no || '').trim() === targetNid) return false;
          return true;
        });
        saveToLocalStorage('platformApplicants', next);
        return next;
      });

      pendingApplicantOpsRef.current += 1;
      try {
        await Promise.all(
          Array.from(idsToDelete).map(delKey =>
            platformApplicantsAPI.delete(encodeURIComponent(delKey)).catch(err => console.error(err))
          )
        );
      } finally {
        pendingApplicantOpsRef.current = Math.max(0, pendingApplicantOpsRef.current - 1);
      }
    }
  };

  const bulkImportPlatformApplicants = async (applicantList, userList = []) => {
    const newApplicants = applicantList.map(a => ({
      ...a,
      id: a.id || String(Date.now() + Math.random()),
      exam_date: a.exam_date ? normalizeExamDate(a.exam_date) : '',
      exam_time: a.exam_time ? normalizeExamTime(a.exam_time) : ''
    }));

    newApplicants.forEach(a => {
      if (a.id) deletedApplicantIdsRef.current.delete(String(a.id));
      const nid = String(a.national_id || a.passport_no || '').trim();
      if (nid) deletedApplicantIdsRef.current.delete(nid);
    });

    pendingApplicantOpsRef.current += 1;
    try {
      await platformApplicantsAPI.bulkImport(newApplicants);
    } catch (err) {
      console.error('Failed platform applicants bulk import:', err);
      alert('فشل حفظ المتقدمين في قاعدة البيانات: ' + err.message);
      throw err;
    } finally {
      pendingApplicantOpsRef.current = Math.max(0, pendingApplicantOpsRef.current - 1);
    }

    setPlatformApplicants(prev => {
      const next = [...prev, ...newApplicants];
      saveToLocalStorage('platformApplicants', next);
      return next;
    });

    if (userList && userList.length > 0) {
      const newUsers = userList.map(u => ({
        ...u,
        id: u.id || String(Date.now() + Math.random()),
        created_at: new Date().toLocaleDateString('ar-EG')
      }));
      try {
        await usersAPI.bulkImport(newUsers);
      } catch (err) {
        console.error('Failed bulk import applicant users:', err);
      }
      setUsers(prev => {
        const uniqueUsers = [...prev];
        newUsers.forEach(nu => {
          if (!uniqueUsers.some(u => String(u.national_id).trim() === String(nu.national_id).trim())) {
            uniqueUsers.push(nu);
          }
        });
        saveToLocalStorage('users', uniqueUsers);
        return uniqueUsers;
      });
    }
  };

  const refreshPlatformApplicants = async () => {
    try {
      const [remoteApps, remotePG] = await Promise.all([
        platformApplicantsAPI.getAll(),
        placementGroupsAPI.getAll().catch(() => null),
      ]);
      if (Array.isArray(remoteApps)) {
        const deletedSet = deletedApplicantIdsRef.current;
        const normApps = remoteApps
          .map(item => {
            const norm = {
              ...item,
              id: item.id || item._id,
              exam_date: item.exam_date ? normalizeExamDate(item.exam_date) : '',
              exam_time: item.exam_time ? normalizeExamTime(item.exam_time) : ''
            };
            return rescheduleApplicantDay9(norm);
          })
          .filter(item => {
            if (deletedSet.has(String(item.id))) return false;
            if (item._id && deletedSet.has(String(item._id))) return false;
            const nid = String(item.national_id || item.passport_no || '').trim();
            if (nid && deletedSet.has(nid)) return false;
            return true;
          });
        setPlatformApplicants(normApps);
        saveToLocalStorage('platformApplicants', normApps);

        if (Array.isArray(remotePG) && remotePG.length > 0) {
          const normPG = remotePG
            .map(g => ({ ...g, id: g.id || g._id }))
            .sort((a, b) => (Number(a.group_no) || 0) - (Number(b.group_no) || 0));
          setPlacementGroups(normPG);
          saveToLocalStorage('placementGroups', normPG);
        }

        return normApps;
      }
      return platformApplicants;
    } catch (err) {
      console.error('Failed to refresh platform applicants:', err);
      throw err;
    }
  };

  const addPlatformRowaq = (item) => {
    const newItem = { ...item, id: String(Date.now()), levels: item.levels || 0, created_at: new Date().toISOString().split('T')[0] };
    setPlatformRowaqs(prev => [...prev, newItem]);
    platformRowaqsAPI.create(newItem).catch(err => console.error(err));
  };
  const updatePlatformRowaq = (id, updatedItem) => {
    setPlatformRowaqs(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...updatedItem } : m));
    platformRowaqsAPI.update(id, updatedItem).catch(err => console.error(err));
  };
  const deletePlatformRowaq = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setPlatformRowaqs(prev => prev.filter(m => String(m.id) !== String(id)));
      platformRowaqsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const verifyDeleteAllPassword = () => {
    const password = prompt('الرجاء إدخال كلمة المرور لتأكيد حذف الجميع:');
    if (password === '4219') {
      return true;
    }
    if (password !== null) {
      alert('كلمة المرور غير صحيحة!');
    }
    return false;
  };

  const deleteAllStudents = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع الطلاب؟ هذه العملية لا يمكن التراجع عنها.')) {
      setStudents([]);
      studentsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllMohfezs = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع المحفظين؟ هذه العملية لا يمكن التراجع عنها.')) {
      setMohfezs([]);
      mohfezsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllCoordinators = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع المنسقين؟ هذه العملية لا يمكن التراجع عنها.')) {
      setCoordinators([]);
      coordinatorsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllBranches = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع الفروع؟ هذه العملية لا يمكن التراجع عنها.')) {
      setBranches([]);
      branchesAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllSessions = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع الحلقات؟ هذه العملية لا يمكن التراجع عنها.')) {
      setSessions([]);
      sessionsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllManagers = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع المشرفين والمدراء؟ هذه العملية لا يمكن التراجع عنها.')) {
      setManagers([]);
      managersAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllApplicants = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع طلبات التقديم؟ هذه العملية لا يمكن التراجع عنها.')) {
      setApplicants([]);
      applicantsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformTopManagement = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع أعضاء الإدارة العليا للمنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformTopManagement([]);
      platformTopManagementAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformSupervisors = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع مشرفي المنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformSupervisors([]);
      platformSupervisorsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformCoordinators = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع منسقي المنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformCoordinators([]);
      platformCoordinatorsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformMohfezs = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع محفظي المنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformMohfezs([]);
      platformMohfezsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformSessions = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع حلقات المنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformSessions([]);
      platformSessionsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformStudents = () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع دارسي المنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformStudents([]);
      platformStudentsAPI.deleteAll().catch(err => console.error(err));
    }
  };

  const deleteAllPlatformApplicants = async () => {
    if (!verifyDeleteAllPassword()) return;
    if (window.confirm('هل أنت متأكد من حذف جميع طلبات تقديم المنصة؟ هذه العملية لا يمكن التراجع عنها.')) {
      setPlatformApplicants([]);
      saveToLocalStorage('platformApplicants', []);
      pendingApplicantOpsRef.current += 1;
      try {
        await platformApplicantsAPI.deleteAll();
      } catch (err) {
        console.error(err);
      } finally {
        pendingApplicantOpsRef.current = Math.max(0, pendingApplicantOpsRef.current - 1);
      }
    }
  };

  // --- Sharia CRUD Operations ---
  const addShariaCourse = (course) => {
    const newCourse = { ...course, id: String(Date.now() + Math.random()) };
    setShariaCourses(prev => [...prev, newCourse]);
    shariaCoursesAPI.create(newCourse).catch(err => console.error(err));
  };
  const updateShariaCourse = (id, updatedCourse) => {
    setShariaCourses(prev => prev.map(c => String(c.id) === String(id) ? { ...c, ...updatedCourse } : c));
    shariaCoursesAPI.update(id, updatedCourse).catch(err => console.error(err));
  };
  const deleteShariaCourse = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const courseToDelete = shariaCourses.find(c => String(c.id) === String(id));
      if (courseToDelete) {
        const normCourseName = normalizeArabic(courseToDelete.name).trim();
        
        // Remove associated shariaLiveLectures from state, localStorage, and DB
        setShariaLiveLectures(prev => {
          const remaining = prev.filter(l => normalizeArabic(l.title).trim() !== normCourseName);
          const livesToDelete = prev.filter(l => normalizeArabic(l.title).trim() === normCourseName);
          livesToDelete.forEach(l => {
            shariaLivesAPI.delete(l.id).catch(err => console.error(err));
          });
          return remaining;
        });

        // Clean up shariaSchedules as well
        setShariaSchedules(prev => {
          return prev.filter(s => normalizeArabic(s.courseName || s.title).trim() !== normCourseName);
        });
      }
      setShariaCourses(prev => prev.filter(c => String(c.id) !== String(id)));
      shariaCoursesAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addShariaBranch = (branch) => {
    const newBranch = { ...branch, id: String(Date.now() + Math.random()) };
    setShariaBranches(prev => [...prev, newBranch]);
    shariaBranchesAPI.create(newBranch).catch(err => console.error(err));
  };
  const updateShariaBranch = (id, updatedBranch) => {
    setShariaBranches(prev => prev.map(b => String(b.id) === String(id) ? { ...b, ...updatedBranch } : b));
    shariaBranchesAPI.update(id, updatedBranch).catch(err => console.error(err));
  };
  const deleteShariaBranch = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setShariaBranches(prev => prev.filter(b => String(b.id) !== String(id)));
      shariaBranchesAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addShariaStudent = (student) => {
    const newStudent = { ...student, id: String(Date.now() + Math.random()) };
    setShariaStudents(prev => [...prev, newStudent]);
    shariaStudentsAPI.create(newStudent).catch(err => console.error(err));
  };
  const updateShariaStudent = async (id, updatedStudent) => {
    const previousStudents = [...shariaStudents];
    setShariaStudents(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...updatedStudent } : s));
    try {
      await shariaStudentsAPI.update(id, updatedStudent);
    } catch (err) {
      console.error('Failed to update sharia student on backend:', err);
      alert('فشل حفظ التعديلات في قاعدة البيانات: ' + (err.message || 'خطأ غير معروف'));
      setShariaStudents(previousStudents);
    }
  };
  const deleteShariaStudent = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = shariaStudents.find(s => String(s.id) === String(id));
      if (item && item.nationalId) deleteUserByNationalId(item.nationalId);
      setShariaStudents(prev => prev.filter(s => String(s.id) !== String(id)));
      shariaStudentsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const bulkImportShariaStudents = async (studentList) => {
    const newStudents = studentList.map(s => ({
      ...s,
      id: s.id || String(Date.now() + Math.random())
    }));
    try {
      await shariaStudentsAPI.bulkImport(newStudents);
    } catch (err) {
      console.error('Failed to bulk import sharia students to DB:', err);
      alert('فشل حفظ الطلاب في قاعدة البيانات: ' + err.message);
      throw err;
    }
    setShariaStudents(prev => [...prev, ...newStudents]);
    const saved = getFromLocalStorage('sharia_students', []);
    saveToLocalStorage('sharia_students', [...saved, ...newStudents]);
  };

  const addShariaTeacher = (teacher) => {
    const newTeacher = { ...teacher, id: String(Date.now() + Math.random()) };
    setShariaTeachers(prev => [...prev, newTeacher]);
    shariaTeachersAPI.create(newTeacher).catch(err => console.error(err));
  };
  const updateShariaTeacher = async (id, updatedTeacher) => {
    const previousTeachers = [...shariaTeachers];
    setShariaTeachers(prev => prev.map(t => String(t.id) === String(id) ? { ...t, ...updatedTeacher } : t));
    try {
      await shariaTeachersAPI.update(id, updatedTeacher);
    } catch (err) {
      console.error('Failed to update sharia teacher on backend:', err);
      alert('فشل حفظ التعديلات في قاعدة البيانات: ' + (err.message || 'خطأ غير معروف'));
      setShariaTeachers(previousTeachers);
    }
  };
  const deleteShariaTeacher = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      const item = shariaTeachers.find(t => String(t.id) === String(id));
      if (item && item.nationalId) deleteUserByNationalId(item.nationalId);
      setShariaTeachers(prev => prev.filter(t => String(t.id) !== String(id)));
      shariaTeachersAPI.delete(id).catch(err => console.error(err));
    }
  };
  const bulkImportShariaTeachers = async (teacherList) => {
    const newTeachers = teacherList.map(t => ({
      ...t,
      id: t.id || String(Date.now() + Math.random())
    }));
    try {
      await shariaTeachersAPI.bulkImport(newTeachers);
    } catch (err) {
      console.error('Failed to bulk import sharia teachers to DB:', err);
      alert('فشل حفظ المحاضرين في قاعدة البيانات: ' + err.message);
      throw err;
    }
    setShariaTeachers(prev => [...prev, ...newTeachers]);
    const saved = getFromLocalStorage('sharia_teachers', []);
    saveToLocalStorage('sharia_teachers', [...saved, ...newTeachers]);
  };

  const addShariaLive = (live) => {
    const id = String(Date.now() + Math.random());
    const cleanId = id.replace(/[^a-zA-Z0-9-_]/g, '');
    const newLive = { 
      ...live, 
      id,
      link: live.streamType === 'external' ? live.link : `https://meet.jit.si/RowaqShariaLive${cleanId}`
    };
    setShariaLiveLectures(prev => [...prev, newLive]);
    shariaLivesAPI.create(newLive).catch(err => console.error(err));
  };
  const updateShariaLive = (id, updatedLive) => {
    const cleanId = String(id).replace(/[^a-zA-Z0-9-_]/g, '');
    const finalLive = {
      ...updatedLive,
      link: updatedLive.streamType === 'external' ? updatedLive.link : `https://meet.jit.si/RowaqShariaLive${cleanId}`
    };
    setShariaLiveLectures(prev => prev.map(l => String(l.id) === String(id) ? { ...l, ...finalLive } : l));
    shariaLivesAPI.update(id, finalLive).catch(err => console.error(err));
  };
  const deleteShariaLive = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setShariaLiveLectures(prev => prev.filter(l => String(l.id) !== String(id)));
      shariaLivesAPI.delete(id).catch(err => console.error(err));
    }
  };

  const addShariaNews = (newsItem) => {
    const newNews = { ...newsItem, id: String(Date.now() + Math.random()) };
    setShariaNews(prev => [...prev, newNews]);
    shariaNewsAPI.create(newNews).catch(err => console.error(err));
  };
  const updateShariaNews = (id, updatedNews) => {
    setShariaNews(prev => prev.map(n => String(n.id) === String(id) ? { ...n, ...updatedNews } : n));
    shariaNewsAPI.update(id, updatedNews).catch(err => console.error(err));
  };
  const deleteShariaNews = (id) => {
    setShariaNews(prev => prev.filter(n => String(n.id) !== String(id)));
    shariaNewsAPI.delete(id).catch(err => console.error(err));
  };

  const addShariaSchedule = (schedule) => {
    const newSchedule = { ...schedule, id: String(Date.now() + Math.random()) };
    setShariaSchedules(prev => [...prev, newSchedule]);
  };
  const updateShariaSchedule = (id, updatedSchedule) => {
    setShariaSchedules(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...updatedSchedule } : s));
  };
  const deleteShariaSchedule = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setShariaSchedules(prev => prev.filter(s => String(s.id) !== String(id)));
    }
  };

  const addShariaAttendance = (record) => {
    const newRecord = { ...record, id: String(Date.now() + Math.random()) };
    setShariaAttendance(prev => [...prev, newRecord]);
  };

  const addLectureAccessLog = (log) => {
    const newLog = { ...log, id: String(Date.now() + Math.random()), timestamp: new Date().toISOString(), durationMinutes: log.durationMinutes || 0 };
    setLectureAccessLogs(prev => {
      const exists = prev.some(l => l.studentId === log.studentId && l.lectureId === log.lectureId);
      if (exists) return prev;
      return [...prev, newLog];
    });
  };

  const updateLectureAccessDuration = (studentId, lectureId, durationMinutes) => {
    setLectureAccessLogs(prev => {
      return prev.map(log => {
        if (log.studentId === studentId && String(log.lectureId) === String(lectureId)) {
          return { ...log, durationMinutes: Math.max(log.durationMinutes || 0, durationMinutes) };
        }
        return log;
      });
    });
  };

  const addShariaDailyReport = (report) => {
    const newReport = { ...report, id: String(Date.now() + Math.random()) };
    setShariaDailyReports(prev => [newReport, ...prev]);
    shariaDailyReportsAPI.create(newReport).catch(err => console.error(err));
  };
  const updateShariaDailyReport = (id, updatedReport) => {
    setShariaDailyReports(prev => prev.map(r => String(r.id) === String(id) ? { ...r, ...updatedReport } : r));
    shariaDailyReportsAPI.update(id, updatedReport).catch(err => console.error(err));
  };
  const deleteShariaDailyReport = (id) => {
    if (window.confirm('هل أنت متأكد من عملية الحذف؟')) {
      setShariaDailyReports(prev => prev.filter(r => String(r.id) !== String(id)));
      shariaDailyReportsAPI.delete(id).catch(err => console.error(err));
    }
  };

  const updateRolePermissions = (newPermissions) => {
    setRolePermissions(newPermissions);
  };

  const hasPermission = (module, action) => {
    try {
      const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
      const role = currentUser ? currentUser.role : 'admin';
      const rolePerms = rolePermissions[role] || defaultPermissions[role] || defaultPermissions.student;
      return rolePerms && rolePerms[module] ? !!rolePerms[module][action] : false;
    } catch {
      return true;
    }
  };
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <AppDataContext.Provider value={{
      managers, addManager, updateManager, deleteManager, deleteAllManagers,
      monthlyReports, addMonthlyReport, updateMonthlyReport, deleteMonthlyReport,
      branches, addBranch, updateBranch, deleteBranch, deleteAllBranches,
      coordinators, addCoordinator, updateCoordinator, deleteCoordinator, deleteAllCoordinators,
      mohfezs, addMohfez, updateMohfez, deleteMohfez, deleteAllMohfezs,
      sessions, addSession, updateSession, deleteSession, deleteAllSessions,
      students, addStudent, updateStudent, deleteStudent, deleteAllStudents, bulkImportStudents,
      followUpReports, addFollowUpReport, confirmFollowUpReport,
      applicants, addApplicant, updateApplicant, deleteApplicant, deleteAllApplicants,
      administrations, addCenterToAdmin,
      rowaqs, addRowaq, updateRowaq, deleteRowaq,
      users, deleteUser, addUser, updateUser, syncNationalIdChange,
      applicantBranches, addApplicantBranch, updateApplicantBranch, deleteApplicantBranch,
      auditLogs,
      attendances, addAttendance, deleteAttendance,
      sessionReports, addSessionReport, deleteSessionReport,
      updateAttendance, recordSessionJoin, staffAttendances,
      substitutions, addSubstitution, deleteSubstitution,
      holidays, addHoliday, deleteHoliday,
      announcements, addAnnouncement, deleteAnnouncement,
      announcementReplies, addAnnouncementReply, markAnnouncementRepliesRead,

      platformTopManagement, addPlatformTopManagement, updatePlatformTopManagement, deletePlatformTopManagement, deleteAllPlatformTopManagement,
      platformSupervisors, addPlatformSupervisor, updatePlatformSupervisor, deletePlatformSupervisor, deleteAllPlatformSupervisors,
      platformCoordinators, addPlatformCoordinator, updatePlatformCoordinator, deletePlatformCoordinator, deleteAllPlatformCoordinators,
      platformMohfezs, addPlatformMohfez, updatePlatformMohfez, deletePlatformMohfez, deleteAllPlatformMohfezs,
      platformSessions, addPlatformSession, updatePlatformSession, deletePlatformSession, deleteAllPlatformSessions,
      platformStudents, addPlatformStudent, updatePlatformStudent, deletePlatformStudent, deleteAllPlatformStudents, bulkImportPlatformStudents,
      platformApplicants, setPlatformApplicants, addPlatformApplicant, updatePlatformApplicant, deletePlatformApplicant, deleteAllPlatformApplicants, bulkImportPlatformApplicants, refreshPlatformApplicants,
      placementGroups, updatePlacementGroup,
      platformRowaqs, addPlatformRowaq, updatePlatformRowaq, deletePlatformRowaq,

      shariaCourses, addShariaCourse, updateShariaCourse, deleteShariaCourse,
      shariaBranches, addShariaBranch, updateShariaBranch, deleteShariaBranch,
      shariaStudents, addShariaStudent, updateShariaStudent, deleteShariaStudent, bulkImportShariaStudents,
      shariaTeachers, addShariaTeacher, updateShariaTeacher, deleteShariaTeacher, bulkImportShariaTeachers,
      shariaLiveLectures, addShariaLive, updateShariaLive, deleteShariaLive,
      shariaNews, addShariaNews, updateShariaNews, deleteShariaNews,
      shariaSchedules, addShariaSchedule, updateShariaSchedule, deleteShariaSchedule,
      shariaAttendance, addShariaAttendance,
      lectureAccessLogs, addLectureAccessLog, updateLectureAccessDuration,
      shariaDailyReports, addShariaDailyReport, updateShariaDailyReport, deleteShariaDailyReport,

      theme, toggleTheme,
      dbSynced,
      rolePermissions, updateRolePermissions, hasPermission,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
