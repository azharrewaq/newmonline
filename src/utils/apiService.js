// API Configuration
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If deployed on Vercel or any public domain, use relative path
    if (hostname.includes('vercel.app') || (!['localhost', '127.0.0.1'].includes(hostname) && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname))) {
      return '/api';
    }
    return `http://${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};
const API_BASE_URL = getApiBaseUrl();

// Helper function for API calls
export const apiCall = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {}
  } = options;

  const config = {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API error');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Managers API
export const managersAPI = {
  getAll: () => apiCall('/managers'),
  getById: (id) => apiCall(`/managers/${id}`),
  create: (data) => apiCall('/managers', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/managers/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/managers/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/managers/all', { method: 'DELETE' }),
  bulkImport: (managers) => apiCall('/managers/bulk-import', { method: 'POST', body: { managers } })
};

// Coordinators API
export const coordinatorsAPI = {
  getAll: () => apiCall('/coordinators'),
  create: (data) => apiCall('/coordinators', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/coordinators/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/coordinators/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/coordinators/all', { method: 'DELETE' }),
  bulkImport: (coordinators) => apiCall('/coordinators/bulk-import', { method: 'POST', body: { coordinators } })
};

// Mohfezs API
export const mohfezsAPI = {
  getAll: () => apiCall('/mohfezs'),
  create: (data) => apiCall('/mohfezs', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/mohfezs/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/mohfezs/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/mohfezs/all', { method: 'DELETE' }),
  bulkImport: (mohfezs) => apiCall('/mohfezs/bulk-import', { method: 'POST', body: { mohfezs } })
};

// Students API
export const studentsAPI = {
  getAll: () => apiCall('/students'),
  create: (data) => apiCall('/students', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/students/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/students/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/students/all', { method: 'DELETE' }),
  bulkImport: (students) => apiCall('/students/bulk-import', { method: 'POST', body: { students } })
};

// Branches API
export const branchesAPI = {
  getAll: () => apiCall('/branches'),
  create: (data) => apiCall('/branches', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/branches/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/branches/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/branches/all', { method: 'DELETE' }),
  bulkImport: (branches) => apiCall('/branches/bulk-import', { method: 'POST', body: { branches } })
};

// Sessions API
export const sessionsAPI = {
  getAll: () => apiCall('/sessions'),
  create: (data) => apiCall('/sessions', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/sessions/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/sessions/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/sessions/all', { method: 'DELETE' }),
  bulkImport: (sessions) => apiCall('/sessions/bulk-import', { method: 'POST', body: { sessions } })
};

// Users API
export const usersAPI = {
  getAll: () => apiCall('/users'),
  getByUsername: (username) => apiCall(`/users/${username}`),
  create: (data) => apiCall('/users', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/users/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/users/${id}`, { method: 'DELETE' }),
  bulkImport: (users) => apiCall('/users/bulk-import', { method: 'POST', body: { users } })
};

// Monthly Reports API
export const monthlyReportsAPI = {
  getAll: () => apiCall('/monthlyreports'),
  create: (data) => apiCall('/monthlyreports', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/monthlyreports/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/monthlyreports/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/monthlyreports/bulk-import', { method: 'POST', body: { items } })
};

// Follow Up Reports API
export const followUpReportsAPI = {
  getAll: () => apiCall('/followupreports'),
  create: (data) => apiCall('/followupreports', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/followupreports/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/followupreports/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/followupreports/bulk-import', { method: 'POST', body: { items } })
};

// Applicants API
export const applicantsAPI = {
  getAll: () => apiCall('/applicants'),
  create: (data) => apiCall('/applicants', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/applicants/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/applicants/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/applicants/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/applicants/bulk-import', { method: 'POST', body: { items } })
};

// Rowaqs API
export const rowaqsAPI = {
  getAll: () => apiCall('/rowaqs'),
  create: (data) => apiCall('/rowaqs', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/rowaqs/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/rowaqs/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/rowaqs/bulk-import', { method: 'POST', body: { items } })
};

// Applicant Branches API
export const applicantBranchesAPI = {
  getAll: () => apiCall('/applicantbranches'),
  create: (data) => apiCall('/applicantbranches', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/applicantbranches/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/applicantbranches/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/applicantbranches/bulk-import', { method: 'POST', body: { items } })
};

// Attendances API
export const attendancesAPI = {
  getAll: () => apiCall('/attendances'),
  create: (data) => apiCall('/attendances', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/attendances/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/attendances/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/attendances/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/attendances/bulk-import', { method: 'POST', body: { items } })
};

// Session Reports API
export const sessionReportsAPI = {
  getAll: () => apiCall('/sessionreports'),
  create: (data) => apiCall('/sessionreports', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/sessionreports/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/sessionreports/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/sessionreports/bulk-import', { method: 'POST', body: { items } })
};

// Platform Top Management API
export const platformTopManagementAPI = {
  getAll: () => apiCall('/platformtopmanagement'),
  create: (data) => apiCall('/platformtopmanagement', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformtopmanagement/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformtopmanagement/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformtopmanagement/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformtopmanagement/bulk-import', { method: 'POST', body: { items } })
};

// Platform Supervisors API
export const platformSupervisorsAPI = {
  getAll: () => apiCall('/platformsupervisors'),
  create: (data) => apiCall('/platformsupervisors', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformsupervisors/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformsupervisors/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformsupervisors/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformsupervisors/bulk-import', { method: 'POST', body: { items } })
};

// Platform Coordinators API
export const platformCoordinatorsAPI = {
  getAll: () => apiCall('/platformcoordinators'),
  create: (data) => apiCall('/platformcoordinators', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformcoordinators/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformcoordinators/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformcoordinators/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformcoordinators/bulk-import', { method: 'POST', body: { items } })
};

// Platform Mohfezs API
export const platformMohfezsAPI = {
  getAll: () => apiCall('/platformmohfezs'),
  create: (data) => apiCall('/platformmohfezs', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformmohfezs/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformmohfezs/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformmohfezs/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformmohfezs/bulk-import', { method: 'POST', body: { items } })
};

// Platform Sessions API
export const platformSessionsAPI = {
  getAll: () => apiCall('/platformsessions'),
  create: (data) => apiCall('/platformsessions', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformsessions/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformsessions/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformsessions/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformsessions/bulk-import', { method: 'POST', body: { items } })
};

// Platform Students API
export const platformStudentsAPI = {
  getAll: () => apiCall('/platformstudents'),
  create: (data) => apiCall('/platformstudents', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformstudents/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformstudents/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformstudents/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformstudents/bulk-import', { method: 'POST', body: { items } })
};

// Platform Applicants API
export const platformApplicantsAPI = {
  getAll: async () => {
    try {
      const [b1, b2] = await Promise.all([
        apiCall('/platformapplicants?batch=1'),
        apiCall('/platformapplicants?batch=2')
      ]);
      if (Array.isArray(b1) && Array.isArray(b2)) {
        return [...b1, ...b2];
      }
      if (Array.isArray(b1)) return b1;
      return await apiCall('/platformapplicants');
    } catch {
      return await apiCall('/platformapplicants');
    }
  },
  create: (data) => apiCall('/platformapplicants', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformapplicants/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformapplicants/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/platformapplicants/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformapplicants/bulk-import', { method: 'POST', body: { items } }),
  rescheduleDay9: () => apiCall('/platformapplicants/reschedule-day9', { method: 'POST' }),
  splitGroupTimes: () => apiCall('/platformapplicants/split-group-times', { method: 'POST' })
};

// Platform Rowaqs API
export const platformRowaqsAPI = {
  getAll: () => apiCall('/platformrowaqs'),
  create: (data) => apiCall('/platformrowaqs', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/platformrowaqs/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/platformrowaqs/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/platformrowaqs/bulk-import', { method: 'POST', body: { items } })
};

// Administrations API
export const administrationsAPI = {
  getAll: () => apiCall('/administrations'),
  create: (data) => apiCall('/administrations', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/administrations/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/administrations/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/administrations/bulk-import', { method: 'POST', body: { items } })
};

// Role Permissions API
export const rolePermissionsAPI = {
  getAll: () => apiCall('/rolepermissions'),
  create: (data) => apiCall('/rolepermissions', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/rolepermissions/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/rolepermissions/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/rolepermissions/bulk-import', { method: 'POST', body: { items } })
};

// Sharia Courses API
export const shariaCoursesAPI = {
  getAll: () => apiCall('/shariacourses'),
  create: (data) => apiCall('/shariacourses', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/shariacourses/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/shariacourses/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/shariacourses/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/shariacourses/bulk-import', { method: 'POST', body: { items } })
};

// Sharia Branches API
export const shariaBranchesAPI = {
  getAll: () => apiCall('/shariabranches'),
  create: (data) => apiCall('/shariabranches', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/shariabranches/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/shariabranches/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/shariabranches/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/shariabranches/bulk-import', { method: 'POST', body: { items } })
};

// Sharia Students API
export const shariaStudentsAPI = {
  getAll: () => apiCall('/shariastudents'),
  create: (data) => apiCall('/shariastudents', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/shariastudents/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/shariastudents/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/shariastudents/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/shariastudents/bulk-import', { method: 'POST', body: { items } })
};

// Sharia Teachers API
export const shariaTeachersAPI = {
  getAll: () => apiCall('/shariateachers'),
  create: (data) => apiCall('/shariateachers', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/shariateachers/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/shariateachers/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/shariateachers/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/shariateachers/bulk-import', { method: 'POST', body: { items } })
};

// Sharia Lives API
export const shariaLivesAPI = {
  getAll: () => apiCall('/sharialives'),
  create: (data) => apiCall('/sharialives', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/sharialives/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/sharialives/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/sharialives/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/sharialives/bulk-import', { method: 'POST', body: { items } })
};

// Sharia Daily Reports API
export const shariaDailyReportsAPI = {
  getAll: () => apiCall('/shariadailyreports'),
  create: (data) => apiCall('/shariadailyreports', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/shariadailyreports/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/shariadailyreports/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/shariadailyreports/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/shariadailyreports/bulk-import', { method: 'POST', body: { items } })
};

// Sharia News API
export const shariaNewsAPI = {
  getAll: () => apiCall('/sharianews'),
  create: (data) => apiCall('/sharianews', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/sharianews/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/sharianews/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/sharianews/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/sharianews/bulk-import', { method: 'POST', body: { items } })
};

// Holidays API (إجازات المنصة)
export const holidaysAPI = {
  getAll: () => apiCall('/holidays'),
  create: (data) => apiCall('/holidays', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/holidays/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/holidays/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/holidays/bulk-import', { method: 'POST', body: { items } })
};

// Announcements API (التعليمات والإعلانات)
export const announcementsAPI = {
  getAll: () => apiCall('/announcements'),
  create: (data) => apiCall('/announcements', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/announcements/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/announcements/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/announcements/bulk-import', { method: 'POST', body: { items } })
};

// Announcement Replies API (ردود الدارسين على الإعلانات)
export const announcementRepliesAPI = {
  getAll: () => apiCall('/announcementreplies'),
  create: (data) => apiCall('/announcementreplies', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/announcementreplies/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/announcementreplies/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/announcementreplies/bulk-import', { method: 'POST', body: { items } })
};

// Staff Attendances API (حضور المحفظين والمنسقين)
export const staffAttendancesAPI = {
  getAll: () => apiCall('/staffattendances'),
  create: (data) => apiCall('/staffattendances', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/staffattendances/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/staffattendances/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/staffattendances/bulk-import', { method: 'POST', body: { items } })
};

// Substitutions API (المحفظ البديل ليوم محدد)
export const substitutionsAPI = {
  getAll: () => apiCall('/substitutions'),
  create: (data) => apiCall('/substitutions', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/substitutions/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/substitutions/${id}`, { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/substitutions/bulk-import', { method: 'POST', body: { items } })
};

// Placement Groups API (مجموعات تحديد المستوى الـ 40 للمتقدمين الجدد)
export const placementGroupsAPI = {
  getAll: () => apiCall('/placementgroups'),
  create: (data) => apiCall('/placementgroups', { method: 'POST', body: data }),
  update: (id, data) => apiCall(`/placementgroups/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiCall(`/placementgroups/${id}`, { method: 'DELETE' }),
  deleteAll: () => apiCall('/placementgroups/all', { method: 'DELETE' }),
  bulkImport: (items) => apiCall('/placementgroups/bulk-import', { method: 'POST', body: { items } })
};
