/**
 * userScopeHelper.js
 * يوفر منطقاً موحداً ودقيقاً لفلترة الحلقات، الدارسين، المحفظين، والمنسقين
 * بحيث لا يرى أي شخص (منسق، محفظ، دارس) إلا الحلقات والبيانات الخاصة به فقط.
 */

export const normalizeArabic = (str) => {
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

/**
 * ───────── المحفظ البديل ─────────
 * قائمة بدائل المحفظين (يحدّثها AppDataContext) ليستفيد منها منطق الصلاحيات في كل الصفحات.
 * كل عنصر: { sessionId, date: 'YYYY-MM-DD', substituteName, substituteNationalId }
 */
let activeSubstitutions = [];
export const setActiveSubstitutions = (list) => { activeSubstitutions = Array.isArray(list) ? list : []; };

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getSubstitutionFor = (sessionId, dateStr, list = activeSubstitutions) => {
  const ds = String(dateStr || '').replace(/\//g, '-');
  return (list || []).find(s =>
    String(s.sessionId) === String(sessionId) && String(s.date || '').replace(/\//g, '-') === ds
  ) || null;
};

export const isUserSubstitute = (sub, user) => {
  if (!sub || !user) return false;
  const nid = String(user.national_id || user.username || '').trim();
  if (sub.substituteNationalId && String(sub.substituteNationalId).trim() === nid) return true;
  return !!sub.substituteName && normalizeArabic(sub.substituteName) === normalizeArabic(user.name || '');
};

/**
 * التحقق مما إذا كانت الحلقة تحت إشراف المنسق
 */
export const isSessionSupervisedByCoordinator = (session, user, platformCoordinators = [], users = []) => {
  if (!session || !user) return false;

  const userNormName = normalizeArabic(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // 1. التطابق المباشر مع حقل المنسق في الحلقة
  if (session.coordinator && userNormName && normalizeArabic(session.coordinator) === userNormName) {
    return true;
  }

  // 2. التطابق عبر سجلات منسقي المنصة
  const matchedCoordRecord = platformCoordinators.find(c => 
    (c.national_id && String(c.national_id).trim() === userNationalId) ||
    (c.username && String(c.username).trim() === String(user.username || '').trim()) ||
    (c.name && normalizeArabic(c.name) === userNormName)
  );

  if (matchedCoordRecord && session.coordinator) {
    if (normalizeArabic(session.coordinator) === normalizeArabic(matchedCoordRecord.name || '')) {
      return true;
    }
  }

  // 3. التطابق عبر userSession في حساب المستخدم الحالي
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
     (u.name && normalizeArabic(u.name) === userNormName))
  );

  if (coordUserInList?.userSession) {
    const sId = String(session.id);
    const sNo = String(session.session_no || '');
    const sName = String(session.session_name || '');
    const uS = String(coordUserInList.userSession);
    if (sId === uS || sNo === uS || sName === uS) {
      return true;
    }
  }

  return false;
};

/**
 * التحقق مما إذا كانت الحلقة يقوم بالتحفيظ فيها المحفظ الحالي
 */
export const isSessionTaughtByMohfez = (session, user, platformMohfezs = [], users = []) => {
  if (!session || !user) return false;

  const userNormName = normalizeArabic(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // 1. التطابق المباشر مع حقل المحفظ في الحلقة
  if (session.mohfez && userNormName && normalizeArabic(session.mohfez) === userNormName) {
    return true;
  }

  // 2. التطابق عبر سجلات محفظي المنصة
  const matchedMohRecord = platformMohfezs.find(m => 
    (m.national_id && String(m.national_id).trim() === userNationalId) ||
    (m.username && String(m.username).trim() === String(user.username || '').trim()) ||
    (m.name && normalizeArabic(m.name) === userNormName)
  );

  if (matchedMohRecord && session.mohfez) {
    if (normalizeArabic(session.mohfez) === normalizeArabic(matchedMohRecord.name || '')) {
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
  const mohUserInList = users.find(u => 
    (u.role === 'platform_mohfez' || u.role === 'mohfez') && 
    ((u.national_id && String(u.national_id).trim() === userNationalId) ||
     (u.username && String(u.username).trim() === String(user.username || '').trim()) ||
     (u.name && normalizeArabic(u.name) === userNormName))
  );

  if (mohUserInList?.userSession) {
    const sId = String(session.id);
    const sNo = String(session.session_no || '');
    const sName = String(session.session_name || '');
    const uS = String(mohUserInList.userSession);
    if (sId === uS || sNo === uS || sName === uS) {
      return true;
    }
  }

  return false;
};

/**
 * التحقق مما إذا كانت الحلقة مسجلاً بها الدارس الحالي
 */
export const isSessionAttendedByStudent = (session, user, platformStudents = []) => {
  if (!session || !user) return false;

  const userNormName = normalizeArabic(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // 1. التطابق المباشر عبر userSession
  if (user.userSession) {
    const sId = String(session.id);
    const sNo = String(session.session_no || '');
    const sName = String(session.session_name || '');
    const uS = String(user.userSession);
    if (sId === uS || sNo === uS || sName === uS) {
      return true;
    }
  }

  // 2. البحث عن سجل الدارس في بيانات الدارسين
  const matchedStudent = platformStudents.find(st => {
    const pNo = String(st.passport_no || '').trim();
    const nId = String(st.national_id || '').trim();
    const stName = normalizeArabic(st.name || '');
    return (
      (pNo && pNo === userNationalId) ||
      (nId && nId === userNationalId) ||
      (stName && userNormName && stName === userNormName)
    );
  });

  if (matchedStudent) {
    const stSess = String(matchedStudent.session_id || matchedStudent.session_no || matchedStudent.session_name || '');
    if (stSess) {
      const sId = String(session.id);
      const sNo = String(session.session_no || '');
      const sName = String(session.session_name || '');
      if (sId === stSess || sNo === stSess || sName === stSess) {
        return true;
      }
    }
  }

  return false;
};

/**
 * التحقق من صلاحية وصول المستخدم إلى حلقة معينة
 */
export const isUserAllowedSession = (session, user, {
  platformCoordinators = [],
  platformMohfezs = [],
  platformStudents = [],
  users = []
} = {}) => {
  if (!session || !user) return false;

  const role = user.role || 'admin';

  // المدراء والمشرفون العامون يرون كل شيء
  if (['admin', 'platform_admin', 'platform_supervisor', 'rowaq_admin', 'rowaq_manager', 'rowaq_tech'].includes(role)) {
    return true;
  }

  // منسق المنصة
  if (role === 'platform_coordinator') {
    return isSessionSupervisedByCoordinator(session, user, platformCoordinators, users);
  }

  // محفظ المنصة أو الأروقة
  if (role === 'platform_mohfez' || role === 'mohfez') {
    // محفظ بديل لهذا اليوم: يحل محل المحفظ الأصلي في صلاحية الوصول
    const todaySub = getSubstitutionFor(session.id, localDateStr());
    if (todaySub) return isUserSubstitute(todaySub, user);
    return isSessionTaughtByMohfez(session, user, platformMohfezs, users);
  }

  // الدارس
  if (role === 'student' || role === 'sharia_student') {
    return isSessionAttendedByStudent(session, user, platformStudents);
  }

  // منسق إداري أو علمي لفرع
  if (['branch_admin_coordinator', 'branch_scientific_coordinator'].includes(role)) {
    if (user.userBranch && session.branch && normalizeArabic(session.branch) !== normalizeArabic(user.userBranch)) {
      return false;
    }
    if (user.userSession) {
      return String(session.id) === String(user.userSession) ||
             String(session.session_no) === String(user.userSession) ||
             session.session_name === user.userSession;
    }
    return true;
  }

  return false;
};

/**
 * تصفية قائمة الحلقات وفق صلاحية المستخدم الحالي فقط
 */
export const filterSessionsForUser = (sessions, user, contextData = {}) => {
  if (!sessions || !Array.isArray(sessions)) return [];
  if (!user) return [];

  const role = user.role || 'admin';
  if (['admin', 'platform_admin', 'platform_supervisor'].includes(role)) {
    return sessions;
  }

  return sessions.filter(session => isUserAllowedSession(session, user, contextData));
};

/**
 * تصفية قائمة الدارسين بحيث يرى كل مستخدم الدارسين التابعين لحلقاته فقط
 */
export const filterStudentsForUser = (students, user, {
  platformSessions = [],
  platformCoordinators = [],
  platformMohfezs = [],
  users = []
} = {}) => {
  if (!students || !Array.isArray(students)) return [];
  if (!user) return [];

  const role = user.role || 'admin';

  // المدراء والمشرفون
  if (['admin', 'platform_admin', 'platform_supervisor'].includes(role)) {
    return students;
  }

  const userNormName = normalizeArabic(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // الدارس لا يرى إلا نفسه فقط
  if (role === 'student' || role === 'sharia_student') {
    return students.filter(s => {
      const pNo = String(s.passport_no || '').trim();
      const nId = String(s.national_id || '').trim();
      const sName = normalizeArabic(s.name || '');
      return (pNo && pNo === userNationalId) || (nId && nId === userNationalId) || (sName && sName === userNormName);
    });
  }

  // المنسق يرى فقط طلاب الحلقات التي يشرف عليها
  if (role === 'platform_coordinator') {
    const supervisedSessions = platformSessions.filter(sess =>
      isSessionSupervisedByCoordinator(sess, user, platformCoordinators, users)
    );
    const supervisedIds = new Set();
    supervisedSessions.forEach(s => {
      supervisedIds.add(String(s.id));
      if (s.session_no) supervisedIds.add(String(s.session_no));
      if (s.session_name) supervisedIds.add(String(s.session_name));
    });

    return students.filter(st => {
      const stSess = String(st.session_id || st.session_no || '');
      return stSess && supervisedIds.has(stSess);
    });
  }

  // المحفظ يرى فقط طلاب الحلقات التي يحفظ فيها
  if (role === 'platform_mohfez' || role === 'mohfez') {
    const taughtSessions = platformSessions.filter(sess =>
      isSessionTaughtByMohfez(sess, user, platformMohfezs, users)
    );
    const taughtIds = new Set();
    taughtSessions.forEach(s => {
      taughtIds.add(String(s.id));
      if (s.session_no) taughtIds.add(String(s.session_no));
      if (s.session_name) taughtIds.add(String(s.session_name));
    });

    return students.filter(st => {
      const stSess = String(st.session_id || st.session_no || '');
      return stSess && taughtIds.has(stSess);
    });
  }

  return [];
};

/**
 * تصفية قائمة المحفظين بحيث:
 * - المنسق يرى محفظي حلقاته المشرف عليها فقط
 * - المحفظ يرى نفسه فقط
 * - الدارس يرى محفظ حلقته فقط
 */
export const filterMohfezsForUser = (mohfezs, user, {
  platformSessions = [],
  platformCoordinators = [],
  platformStudents = [],
  users = []
} = {}) => {
  if (!mohfezs || !Array.isArray(mohfezs)) return [];
  if (!user) return [];

  const role = user.role || 'admin';
  if (['admin', 'platform_admin', 'platform_supervisor'].includes(role)) {
    return mohfezs;
  }

  const userNormName = normalizeArabic(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // المحفظ يرى نفسه فقط
  if (role === 'platform_mohfez' || role === 'mohfez') {
    return mohfezs.filter(m => {
      const mNationalId = String(m.national_id || '').trim();
      const mName = normalizeArabic(m.name || '');
      return (mNationalId && mNationalId === userNationalId) || (mName && mName === userNormName);
    });
  }

  // المنسق يرى فقط محفظي الحلقات التي يشرف عليها
  if (role === 'platform_coordinator') {
    const supervisedSessions = platformSessions.filter(sess =>
      isSessionSupervisedByCoordinator(sess, user, platformCoordinators, users)
    );
    const supervisedMohfezs = new Set();
    supervisedSessions.forEach(s => {
      if (s.mohfez) supervisedMohfezs.add(normalizeArabic(s.mohfez));
    });

    return mohfezs.filter(m => supervisedMohfezs.has(normalizeArabic(m.name || '')));
  }

  // الدارس يرى محفظ حلقته
  if (role === 'student') {
    const studentSessions = platformSessions.filter(sess =>
      isSessionAttendedByStudent(sess, user, platformStudents)
    );
    const mohfezsSet = new Set();
    studentSessions.forEach(s => {
      if (s.mohfez) mohfezsSet.add(normalizeArabic(s.mohfez));
    });
    return mohfezs.filter(m => mohfezsSet.has(normalizeArabic(m.name || '')));
  }

  return [];
};

/**
 * تصفية قائمة المنسقين بحيث:
 * - المنسق يرى نفسه فقط
 * - المحفظ أو الدارس يرى منسق حلقته فقط
 */
export const filterCoordinatorsForUser = (coordinators, user, {
  platformSessions = [],
  platformMohfezs = [],
  platformStudents = [],
  users = []
} = {}) => {
  if (!coordinators || !Array.isArray(coordinators)) return [];
  if (!user) return [];

  const role = user.role || 'admin';
  if (['admin', 'platform_admin', 'platform_supervisor'].includes(role)) {
    return coordinators;
  }

  const userNormName = normalizeArabic(user.name || '');
  const userNationalId = String(user.national_id || user.username || '').trim();

  // المنسق يرى نفسه فقط
  if (role === 'platform_coordinator') {
    return coordinators.filter(c => {
      const cNationalId = String(c.national_id || '').trim();
      const cName = normalizeArabic(c.name || '');
      return (cNationalId && cNationalId === userNationalId) || (cName && cName === userNormName);
    });
  }

  // المحفظ يرى منسق حلقته
  if (role === 'platform_mohfez' || role === 'mohfez') {
    const mySessions = platformSessions.filter(sess =>
      isSessionTaughtByMohfez(sess, user, platformMohfezs, users)
    );
    const coordNames = new Set();
    mySessions.forEach(s => {
      if (s.coordinator) coordNames.add(normalizeArabic(s.coordinator));
    });
    return coordinators.filter(c => coordNames.has(normalizeArabic(c.name || '')));
  }

  // الدارس يرى منسق حلقته
  if (role === 'student') {
    const mySessions = platformSessions.filter(sess =>
      isSessionAttendedByStudent(sess, user, platformStudents)
    );
    const coordNames = new Set();
    mySessions.forEach(s => {
      if (s.coordinator) coordNames.add(normalizeArabic(s.coordinator));
    });
    return coordinators.filter(c => coordNames.has(normalizeArabic(c.name || '')));
  }

  return [];
};
