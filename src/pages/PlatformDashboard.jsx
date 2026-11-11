import React from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import PlatformHeroBanner from '../components/PlatformHeroBanner';
import StatsCards from '../components/StatsCards';
import VisionMission from '../components/VisionMission';
import Footer from '../components/Footer';
import { useAppData } from '../context/AppDataContext';
import { filterSessionsForUser, filterStudentsForUser, filterMohfezsForUser } from '../utils/userScopeHelper';

function PlatformDashboard() {
  const {
    platformTopManagement,
    platformSupervisors,
    platformCoordinators,
    platformMohfezs,
    platformSessions,
    platformStudents,
    platformApplicants,
    users = []
  } = useAppData();

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser?.role || 'admin';
  const isSupervisor = role === 'platform_supervisor';
  const isCoordinator = role === 'platform_coordinator';
  const isMohfez = role === 'platform_mohfez' || role === 'mohfez';
  const isStudent = role === 'student' || role === 'sharia_student';
  const isRestricted = isCoordinator || isMohfez || isSupervisor || isStudent;

  // الحلقات والدارسون والمحفظون المخصصون للمستخدم الحالي فقط
  const scopedSessions = React.useMemo(() => {
    return filterSessionsForUser(platformSessions, currentUser, {
      platformCoordinators,
      platformSupervisors,
      platformMohfezs,
      platformStudents,
      users
    });
  }, [platformSessions, currentUser, platformCoordinators, platformSupervisors, platformMohfezs, platformStudents, users]);

  const scopedStudents = React.useMemo(() => {
    return filterStudentsForUser(platformStudents, currentUser, {
      platformSessions,
      platformCoordinators,
      platformSupervisors,
      platformMohfezs,
      users
    });
  }, [platformStudents, currentUser, platformSessions, platformCoordinators, platformSupervisors, platformMohfezs, users]);

  const scopedMohfezs = React.useMemo(() => {
    return filterMohfezsForUser(platformMohfezs, currentUser, {
      platformSessions,
      platformCoordinators,
      platformSupervisors,
      platformStudents,
      users
    });
  }, [platformMohfezs, currentUser, platformSessions, platformCoordinators, platformSupervisors, platformStudents, users]);

  // Compute active sessions count in real-time (من الحلقات التابعة للمستخدم فقط)
  const activeSessionsCount = scopedSessions ? scopedSessions.filter(s => {
    const dayNamesMap = {
      0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت'
    };
    const currentDayName = dayNamesMap[new Date().getDay()];
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const isTodayWorkday = s.workDays && s.workDays.includes(currentDayName);
    if (!isTodayWorkday) return false;
    if (!s.time_start || !s.time_end) return false;
    
    const startMin = timeToMinutes(s.time_start);
    const endMin = timeToMinutes(s.time_end);
    return currentMinutes >= startMin && currentMinutes <= endMin;
  }).length : 0;

  let dynamicStats = [];

  if (isCoordinator) {
    dynamicStats = [
      {
        id: 1,
        title: 'الحلقات المشرف عليها',
        value: scopedSessions.length,
        iconColor: '#ec4899',
        iconType: 'book-open'
      },
      {
        id: 2,
        title: 'المحفظين في حلقاتي',
        value: scopedMohfezs.length,
        iconColor: '#22c55e',
        iconType: 'user-check'
      },
      {
        id: 3,
        title: 'الدارسين في حلقاتي',
        value: scopedStudents.length,
        iconColor: '#06b6d4',
        iconType: 'users'
      },
      {
        id: 4,
        title: 'الحلقات الجارية الآن',
        value: activeSessionsCount,
        iconColor: '#10b981',
        iconType: 'book'
      }
    ];
  } else if (isSupervisor) {
    dynamicStats = [
      {
        id: 1,
        title: 'الحلقات المشرف عليها',
        value: scopedSessions.length,
        iconColor: '#3b82f6',
        iconType: 'book-open'
      },
      {
        id: 2,
        title: 'الدارسين تحت إشرافي',
        value: scopedStudents.length,
        iconColor: '#06b6d4',
        iconType: 'users'
      },
      {
        id: 3,
        title: 'المحفظين تحت إشرافي',
        value: scopedMohfezs.length,
        iconColor: '#22c55e',
        iconType: 'user-check'
      },
      {
        id: 4,
        title: 'الحلقات الجارية الآن',
        value: activeSessionsCount,
        iconColor: '#10b981',
        iconType: 'book'
      }
    ];
  } else if (isMohfez) {
    dynamicStats = [
      {
        id: 1,
        title: 'حلقاتي المسجلة',
        value: scopedSessions.length,
        iconColor: '#ec4899',
        iconType: 'book-open'
      },
      {
        id: 2,
        title: 'الدارسين في حلقاتي',
        value: scopedStudents.length,
        iconColor: '#06b6d4',
        iconType: 'users'
      },
      {
        id: 3,
        title: 'الحلقات الجارية الآن',
        value: activeSessionsCount,
        iconColor: '#10b981',
        iconType: 'book'
      }
    ];
  } else if (isStudent) {
    dynamicStats = [
      {
        id: 1,
        title: 'حلقتي',
        value: scopedSessions.length,
        iconColor: '#ec4899',
        iconType: 'book-open'
      },
      {
        id: 2,
        title: 'المحفظ المشرف',
        value: scopedMohfezs.length,
        iconColor: '#22c55e',
        iconType: 'user-check'
      },
      {
        id: 3,
        title: 'زملاء الحلقة',
        value: scopedStudents.length,
        iconColor: '#06b6d4',
        iconType: 'users'
      }
    ];
  } else {
    // Admin & Management
    dynamicStats = [
      {
        id: 2,
        title: 'الإدارة العليا',
        value: platformTopManagement?.length || 0,
        iconColor: '#eab308',
        iconType: 'users'
      },
      {
        id: 3,
        title: 'المشرفون',
        value: platformSupervisors?.length || 0,
        iconColor: '#3b82f6',
        iconType: 'book'
      },
      {
        id: 4,
        title: 'المنسقون',
        value: platformCoordinators?.length || 0,
        iconColor: '#f97316',
        iconType: 'graduation-cap'
      },
      {
        id: 5,
        title: 'المحفظون',
        value: platformMohfezs?.length || 0,
        iconColor: '#22c55e',
        iconType: 'user-check'
      },
      {
        id: 6,
        title: 'الحلقات',
        value: platformSessions?.length || 0,
        iconColor: '#ec4899',
        iconType: 'book-open'
      },
      {
        id: 7,
        title: 'الدارسون',
        value: platformStudents?.length || 0,
        iconColor: '#06b6d4',
        iconType: 'users'
      },
      {
        id: 8,
        title: 'طلبات التقديم',
        value: platformApplicants?.length || 0,
        iconColor: '#f59e0b',
        iconType: 'user-check'
      },
    ];
  }

  return (
    <div className="dashboard-page">
      <PlatformHeroBanner />
      
      {/* Real-time active sessions card */}
      <div className="active-sessions-highlight" style={{
        maxWidth: '1200px',
        margin: '30px auto 10px',
        padding: '0 20px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(16,185,129,0.08))',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              padding: '16px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <Video size={28} />
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '10px',
                height: '10px',
                backgroundColor: '#10b981',
                borderRadius: '50%',
                boxShadow: '0 0 8px #10b981'
              }} className="pulse-indicator"></span>
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: 'var(--text-primary)' }}>الحلقات الجارية حالياً في الوقت الفعلي</h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>تحديث تلقائي مستند إلى أوقات العمل وجداول الحلقات المسجلة</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#10b981', fontFamily: 'inherit' }}>{activeSessionsCount}</span>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginRight: '6px' }}>حلقة نشطة الآن</span>
            </div>
            <Link 
              to="/platform-sessions?active=true" 
              className="btn btn-primary" 
              style={{ 
                textDecoration: 'none', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '12px 24px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(212,175,55,0.2)'
              }}
            >
              متابعة الحلقات الجارية
            </Link>
          </div>
        </div>
      </div>

      <StatsCards stats={dynamicStats} />
      <VisionMission />
      <Footer />
    </div>
  );
}

export default PlatformDashboard;
