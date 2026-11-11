import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Users, FileText, Calendar, GitBranch, 
  BookOpen, Building, MapPin, UserPlus, FilePlus, Settings, User, LogOut, Shield, ArrowRightLeft, BookOpen as BookIcon, Award, Video, Newspaper, Archive, Clock, UserX, Megaphone, CalendarOff
} from 'lucide-react';

import './Sidebar.css';
import { useAppData } from '../context/AppDataContext';
import { useAnnouncementNotifications } from '../utils/announcementHelpers';

const menuGroups = [
  {
    isAlwaysVisible: true,
    items: [
      { name: 'لوحة تحكم شؤون الأروقة', icon: Home, path: '/dashboard', isRowaqOnly: true },
      { name: 'لوحة تحكم المنصة', icon: Home, path: '/platform-dashboard', isPlatformOnly: true },
      { name: 'لوحة العلوم الشرعية والعربية', icon: Home, path: '/sharia-dashboard', isShariaOnly: true },
    ]
  },
  {
    title: 'إدارة النظام',
    isRowaqOnly: true,
    items: [
      { name: 'أعضاء الإدارة', icon: Users, path: '/management' },
      { name: 'إحصاء التقارير', icon: FileText, path: '/statistics' },
      { name: 'المتابعات الشهرية', icon: Calendar, path: '/monthlyreport' },
    ]
  },
  {
    title: 'إحصائيات الأروقة',
    isRowaqOnly: true,
    items: [
      { name: 'الفروع', icon: GitBranch, path: '/branches' },
      { name: 'المنسقين', icon: User, path: '/coordinators' },
      { name: 'المحفظين', icon: Users, path: '/mohfez' },
      { name: 'الحلقات', icon: Users, path: '/sessions' },
      { name: 'تقارير المحفظين', icon: FileText, path: '/mohfez-reports' },
      { name: 'الدارسين', icon: BookOpen, path: '/students' },
      { name: 'المتقدمين الجدد', icon: UserPlus, path: '/applicants' },
      { name: 'الأرشيف', icon: Archive, path: '/archive' },
    ]
  },
  {
    title: 'إعدادات النظام',
    isRowaqOnly: true, // Only show system settings in Rowaq
    items: [
      { name: 'الإدارات', icon: Building, path: '/administrations', isRowaqOnly: true },
      { name: 'الأروقة', icon: MapPin, path: '/riwaqs', isRowaqOnly: true },
      { name: 'المستخدمين', icon: Users, path: '/users', isSettingsStaff: true },
      { name: 'صلاحيات المستخدمين', icon: Shield, path: '/permissions', isSettingsStaff: true },
      { name: 'فروع طلبات التقديم', icon: FilePlus, path: '/applicant-branches', isRowaqOnly: true },
      { name: 'برج المراقبة', icon: Settings, path: '/towers', isRowaqOnly: true },
      { name: 'الاعدادات', icon: Settings, path: '/settings', isSettingsStaff: true },
    ]
  },
  {
    title: 'إدارة المنصة',
    isPlatformOnly: true,
    items: [
      { name: 'الإدارة العليا', icon: Building, path: '/platform-top-management' },
      { name: 'المشرفين', icon: Users, path: '/platform-supervisors' },
      { name: 'المنسقين', icon: User, path: '/platform-coordinators' },
      { name: 'المحفظين', icon: Users, path: '/platform-mohfez' },
      { name: 'الحلقات', icon: GitBranch, path: '/platform-sessions' },
      { name: 'الدارسين', icon: BookOpen, path: '/platform-students' },
      { name: 'المتقدمين الجدد', icon: UserPlus, path: '/platform-applicants' },
    ]
  },
  {
    title: 'التواصل والإجازات',
    isPlatformOnly: true,
    items: [
      { name: 'التعليمات والإعلانات', icon: Megaphone, path: '/platform-announcements' },
      { name: 'إجازات المنصة', icon: CalendarOff, path: '/platform-holidays' },
    ]
  },
  {
    title: 'التقارير',
    isPlatformOnly: true,
    items: [
      { name: 'بوابة التقارير', icon: FileText, path: '/platform-reports' },
      { name: 'تقرير ساعات المحفظين', icon: Clock, path: '/mohfez-hours-report' },
      { name: 'تقرير أيام عمل المنسقين', icon: Calendar, path: '/coordinator-workdays-report' },
      { name: 'تقرير غياب الدارسين', icon: UserX, path: '/student-absence-report' },
    ]
  },

  {
    title: 'إعدادات المنصة',
    isPlatformOnly: true,
    items: [
      { name: 'المستخدمين', icon: Users, path: '/users' },
      { name: 'صلاحيات المستخدمين', icon: Shield, path: '/permissions' },
      { name: 'الاعدادات', icon: Settings, path: '/settings' },
    ]
  },
  {
    title: 'العلوم الشرعية والعربية',
    isShariaOnly: true,
    items: [
      { name: 'الإدارة العليا (الادمن)', icon: Shield, path: '/sharia-dashboard?tab=admins' },
      { name: 'مسؤولو الإدارات الخارجية', icon: MapPin, path: '/sharia-dashboard?tab=externalAdmins' },
      { name: 'أعضاء هيئة التدريس', icon: Users, path: '/sharia-dashboard?tab=teachers' },
      { name: 'المقررات والمواد الدراسية', icon: BookIcon, path: '/sharia-dashboard?tab=courses' },
      { name: 'فروع العلوم الشرعية', icon: GitBranch, path: '/sharia-dashboard?tab=shariaBranches' },
      { name: 'قسم الدارسين والطلاب', icon: Users, path: '/sharia-dashboard?tab=students' },
      { name: 'البث المباشر والمحاضرات', icon: Video, path: '/sharia-dashboard?tab=live' },
      { name: 'جدول المحاضرات الحضورية', icon: Calendar, path: '/sharia-dashboard?tab=schedules' },
      { name: 'التقارير اليومية للمحاضرات', icon: FileText, path: '/sharia-daily-reports' },
      { name: 'الاختبارات والامتحانات', icon: FileText, path: '/sharia-dashboard?tab=exams' },
      { name: 'نتائج الامتحانات', icon: Award, path: '/sharia-dashboard?tab=results' },
      { name: 'الأخبار والإعلانات', icon: Newspaper, path: '/sharia-dashboard?tab=news' },
    ]
  }
];

function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = 'platform';

  const handleLinkClick = () => {
    if (window.innerWidth < 992 && toggleSidebar) {
      toggleSidebar();
    }
  };

  
  // Get current user and role
  let role = '';
  let specialty = '';
  let currentUser = null;
  try {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (currentUser) {
      role = currentUser.role || '';
      specialty = currentUser.specialty || '';
    }
  } catch (e) {
    console.error('Error parsing currentUser in Sidebar', e);
  }

  const { shariaTeachers = [], mohfezs = [] } = useAppData();
  const { count: notifCount } = useAnnouncementNotifications();
  const nationalId = currentUser ? String(currentUser.national_id || currentUser.username || '').trim() : '';
  const isAlsoShariaTeacher = shariaTeachers.some(t => String(t.nationalId || '').trim() === nationalId);
  const isAlsoMohfez = mohfezs.some(m => String(m.national_id || '').trim() === nationalId);

  const isPathAllowed = (path, userRole) => {
    // صفحة الإعلانات: لإدارة المنصة والدارسين والمحفظين والمنسقين
    if (path === '/platform-announcements') {
      return ['admin', 'platform_admin', 'platform_supervisor', 'platform_coordinator', 'platform_mohfez', 'student'].includes(userRole);
    }
    // صفحة الإجازات: للإدارة فقط
    if (path === '/platform-holidays') {
      return ['admin', 'platform_admin'].includes(userRole);
    }
    // 10. sharia_student (دارس علوم شرعية)
    if (userRole === 'sharia_student') {
      const allowed = [
        '/sharia-dashboard',
        '/sharia-dashboard?tab=courses',
        '/sharia-dashboard?tab=exams',
        '/sharia-dashboard?tab=results',
        '/sharia-dashboard?tab=live',
        '/sharia-dashboard?tab=news'
      ];
      return allowed.includes(path);
    }

    // 11. sharia_teacher (محاضر علوم شرعية)
    if (userRole === 'sharia_teacher' || (userRole === 'mohfez' && isAlsoShariaTeacher)) {
      const allowed = [
        '/sharia-dashboard',
        '/sharia-dashboard?tab=courses',
        '/sharia-dashboard?tab=exams',
        '/sharia-dashboard?tab=results',
        '/sharia-dashboard?tab=live',
        '/sharia-dashboard?tab=schedules',
        '/sharia-dashboard?tab=news'
      ];
      return allowed.includes(path);
    }

    // Sharia paths allowed for admin, rowaq_admin, and the four designated specialties
    if (path.startsWith('/sharia-dashboard') || ['/sharia-courses', '/sharia-teachers', '/sharia-students', '/sharia-sessions', '/sharia-daily-reports'].includes(path)) {
      const shariaSpecialties = [
        'مدير الإدارة',
        'العضو التقني',
        'العضو الإداري علوم شرعية وعربية',
        'العضو العلمي علوم شرعية وعربية',
        'العضو الإداري، علوم شرعية وعربية',
        'العضو العلمي، علوم شرعية وعربية',
        'العضو الإداري للعلوم الشرعية والعربية',
        'العضو العلمي للعلوم الشرعية والعربية'
      ];
      return userRole === 'admin' || userRole === 'rowaq_admin' || userRole === 'sharia_teacher' || shariaSpecialties.includes(specialty);
    }

    // Super Admin can access everything
    if (userRole === 'admin') return true;

    // Restrict Administrations, Rowaqs, and Applicant Branches to Admin/Rowaq Admin only
    if (['/administrations', '/riwaqs', '/applicant-branches'].includes(path)) {
      return userRole === 'rowaq_admin';
    }

    // 1. platform_admin
    if (userRole === 'platform_admin') {
      const allowed = [
        '/platform-dashboard',
        '/platform-top-management',
        '/platform-supervisors',
        '/platform-coordinators',
        '/platform-mohfez',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/platform-reports',
        '/mohfez-hours-report',
        '/coordinator-workdays-report',
        '/student-absence-report',
        '/users',
        '/permissions',
        '/settings'
      ];
      return allowed.includes(path);
    }

    // 1.5. platform_supervisor (المشرف: لا يملك صلاحية المستخدمين والصلاحيات والإعدادات أو الإدارة العليا)
    if (userRole === 'platform_supervisor') {
      const allowed = [
        '/platform-dashboard',
        '/platform-supervisors',
        '/platform-coordinators',
        '/platform-mohfez',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/platform-reports',
        '/mohfez-hours-report',
        '/coordinator-workdays-report',
        '/student-absence-report'
      ];
      return allowed.includes(path);
    }

    // 2. platform_coordinator
    if (userRole === 'platform_coordinator') {
      const allowed = [
        '/platform-dashboard',
        '/platform-coordinators',
        '/platform-mohfez',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/platform-reports',
        '/mohfez-hours-report',
        '/coordinator-workdays-report',
        '/student-absence-report'
      ];
      return allowed.includes(path);
    }

    // 3. platform_mohfez
    if (userRole === 'platform_mohfez') {
      const allowed = [
        '/platform-dashboard',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/mohfez-hours-report',
        '/student-absence-report'
      ];
      return allowed.includes(path);
    }

    // 4. student
    if (userRole === 'student') {
      return ['/platform-sessions'].includes(path);
    }

    // 5. rowaq_admin / rowaq_manager
    if (['rowaq_admin', 'rowaq_manager'].includes(userRole)) {
      const forbidden = [
        '/platform-dashboard',
        '/platform-top-management',
        '/platform-supervisors',
        '/platform-coordinators',
        '/platform-mohfez',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/platform-reports'
      ];
      return !forbidden.includes(path);
    }

    // 6. rowaq_tech
    if (userRole === 'rowaq_tech') {
      const forbidden = [
        '/platform-dashboard',
        '/platform-top-management',
        '/platform-supervisors',
        '/platform-coordinators',
        '/platform-mohfez',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/platform-reports',
        '/users',
        '/permissions',
        '/settings',
        '/towers'
      ];
      return !forbidden.includes(path);
    }

    // 6b. rowaq_member
    if (userRole === 'rowaq_member') {
      const forbidden = [
        '/platform-dashboard',
        '/platform-top-management',
        '/platform-supervisors',
        '/platform-coordinators',
        '/platform-mohfez',
        '/platform-sessions',
        '/platform-students',
        '/platform-applicants',
        '/platform-reports',
        '/users',
        '/permissions',
        '/settings',
        '/towers',
        '/archive'
      ];
      return !forbidden.includes(path);
    }

    // 7. branch_admin_coordinator (منسق إداري لفرع)
    if (userRole === 'branch_admin_coordinator') {
      const allowed = [
        '/dashboard',
        '/branches',
        '/sessions',
        '/mohfez-reports',
        '/students',
        '/applicants'
      ];
      return allowed.includes(path);
    }

    // 8. branch_scientific_coordinator (منسق علمي لفرع)
    if (userRole === 'branch_scientific_coordinator') {
      const allowed = [
        '/dashboard',
        '/sessions',
        '/mohfez-reports',
        '/students'
      ];
      return allowed.includes(path);
    }

    // 9. mohfez (محفظ شؤون الأروقة)
    if (userRole === 'mohfez' || (userRole === 'sharia_teacher' && isAlsoMohfez)) {
      const allowed = [
        '/dashboard',
        '/sessions'
      ];
      return allowed.includes(path);
    }

    return false;
  };


  // Filter groups based on the active main section and path visibility rules
  const filteredGroups = menuGroups.map(group => {
    // Filter out group entirely if it belongs to another section
    if (activeSection === 'rowaq' && (group.isPlatformOnly || group.isShariaOnly)) return null;
    if (activeSection === 'platform' && (group.isRowaqOnly || group.isShariaOnly)) return null;
    if (activeSection === 'sharia_arabic' && (group.isRowaqOnly || group.isPlatformOnly)) return null;

    const items = group.items.filter(item => {
      // Filter individual items within group
      if (activeSection === 'rowaq' && item.isPlatformOnly) return false;
      if (activeSection === 'rowaq' && item.isShariaOnly) return false;
      
      if (activeSection === 'platform' && item.isRowaqOnly) return false;
      if (activeSection === 'platform' && item.isShariaOnly) return false;
      
      if (activeSection === 'sharia_arabic' && item.isRowaqOnly) return false;
      if (activeSection === 'sharia_arabic' && item.isPlatformOnly) return false;

      return isPathAllowed(item.path, role);
    });

    if (items.length === 0) return null;
    return { ...group, items };
  }).filter(Boolean);

  return (
    <>
      {isOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={toggleSidebar}
        />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <img src="/logo.png" alt="Logo" className="logo" />
          <div className="header-titles">
            <h3>لوحة التحكم</h3>
            <p>إدارة النظام</p>
          </div>
        </div>

        <div className="sidebar-menu">
          {filteredGroups.map((group, idx, arr) => (
            <div key={idx} className="menu-group">
              {group.title && <div className="menu-group-title">{group.title}</div>}
              {group.items.map((item, idy) => {
                const Icon = item.icon;
                const isItemActive = () => {
                  if (item.path === '#') return false;
                  const targetPath = item.path.split('?')[0];
                  const currentPath = location.pathname;
                  if (targetPath !== currentPath) return false;
                  if (item.path.includes('?')) {
                    const targetParams = new URLSearchParams(item.path.split('?')[1]);
                    const currentParams = new URLSearchParams(location.search);
                    for (const [key, val] of targetParams.entries()) {
                      if (currentParams.get(key) !== val) return false;
                    }
                    return true;
                  } else {
                    if (targetPath === '/sharia-dashboard') {
                      return !location.search || !location.search.includes('tab=');
                    }
                    return true;
                  }
                };
                return (
                  <NavLink 
                    to={item.path} 
                    key={idy} 
                    className={() => `menu-item ${isItemActive() ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    <Icon size={18} className="menu-icon" />
                    <span>{role === 'student' && item.path === '/platform-sessions' ? 'موعد اختبار تحديد المستوى' : item.name}</span>
                    {item.path === '/platform-announcements' && notifCount > 0 && (
                      <span style={{ marginRight: 'auto', background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 7px', fontSize: 11, fontWeight: 'bold' }}>{notifCount}</span>
                    )}
                  </NavLink>
                );
              })}
              {idx < arr.length - 1 && <hr className="menu-divider" />}
            </div>
          ))}
          
          <div className="menu-group logout-group">
             <hr className="menu-divider" />
             <NavLink to="#" className="menu-item logout-btn" onClick={() => {
               sessionStorage.removeItem('currentUser');
               sessionStorage.removeItem('activeSection');
               window.location.href = '/login';
             }}>
                <LogOut size={18} className="menu-icon" />
                <span>تسجيل الخروج</span>
             </NavLink>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
