import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AppDataProvider } from './context/AppDataContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PlatformDashboard from './pages/PlatformDashboard';
import PlatformTopManagementList from './pages/PlatformTopManagementList';
import PlatformTopManagementCreate from './pages/PlatformTopManagementCreate';
import PlatformSupervisorsList from './pages/PlatformSupervisorsList';
import PlatformSupervisorsCreate from './pages/PlatformSupervisorsCreate';
import PlatformCoordinatorsList from './pages/PlatformCoordinatorsList';
import PlatformCoordinatorsCreate from './pages/PlatformCoordinatorsCreate';
import PlatformMohfezsList from './pages/PlatformMohfezsList';
import PlatformMohfezsCreate from './pages/PlatformMohfezsCreate';
import PlatformSessionsList from './pages/PlatformSessionsList';
import PlatformSessionsCreate from './pages/PlatformSessionsCreate';
import SessionAttendance from './pages/SessionAttendance';
import SessionAttendanceAdd from './pages/SessionAttendanceAdd';
import SessionReports from './pages/SessionReports';
import SessionReportsAdd from './pages/SessionReportsAdd';
import PlatformStudentsList from './pages/PlatformStudentsList';
import PlatformStudentsCreate from './pages/PlatformStudentsCreate';
import PlatformApplicantsList from './pages/PlatformApplicantsList';
import PlatformApplicantsCreate from './pages/PlatformApplicantsCreate';
import PlatformReports from './pages/PlatformReports';
import MohfezHoursReport from './pages/MohfezHoursReport';
import CoordinatorWorkdaysReport from './pages/CoordinatorWorkdaysReport';
import StudentAbsenceReport from './pages/StudentAbsenceReport';
import UsersList from './pages/UsersList';
import PermissionsManagement from './pages/PermissionsManagement';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import PublicHome from './pages/PublicHome';
import PublicQuran from './pages/PublicQuran';
import PublicIslamicStudies from './pages/PublicIslamicStudies';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PlatformAnnouncements from './pages/PlatformAnnouncements';
import PlatformHolidays from './pages/PlatformHolidays';
import LiveSession from './pages/LiveSession';

const initialDashboardData = {
  stats: [
    { id: 1, title: 'الحلقات', value: 0, iconColor: '#3b82f6', iconType: 'book' },
    { id: 2, title: 'المحفظين', value: 0, iconColor: '#eab308', iconType: 'users' },
    { id: 3, title: 'المنسقين', value: 0, iconColor: '#a855f7', iconType: 'graduation-cap' },
    { id: 4, title: 'الدارسين', value: 0, iconColor: '#eab308', iconType: 'book-open' },
    { id: 5, title: 'طلبات التقديم', value: 0, iconColor: '#22c55e', iconType: 'user-check' },
  ]
};

function DashboardLayout() {
  const [dashboardData] = useState(initialDashboardData);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 992) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const isStudentUser = currentUser.role === 'student';

  return (
    <div className="app-layout">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
      
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <div className="content-scroll-area" style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Navigate to={isStudentUser ? '/platform-sessions' : '/platform-dashboard'} replace />} />
            <Route path="/platform-dashboard" element={isStudentUser ? <Navigate to="/platform-sessions" replace /> : <PlatformDashboard />} />
            
            <Route path="/platform-top-management" element={<PlatformTopManagementList />} />
            <Route path="/platform-top-management/create" element={<PlatformTopManagementCreate />} />
            <Route path="/platform-supervisors" element={<PlatformSupervisorsList />} />
            <Route path="/platform-supervisors/create" element={<PlatformSupervisorsCreate />} />
            <Route path="/platform-coordinators" element={<PlatformCoordinatorsList />} />
            <Route path="/platform-coordinators/create" element={<PlatformCoordinatorsCreate />} />
            <Route path="/platform-mohfez" element={<PlatformMohfezsList />} />
            <Route path="/platform-mohfez/create" element={<PlatformMohfezsCreate />} />
            <Route path="/platform-sessions" element={<PlatformSessionsList />} />
            <Route path="/platform-sessions/create" element={<PlatformSessionsCreate />} />
            <Route path="/platform-sessions/:id/attendance" element={<SessionAttendance />} />
            <Route path="/platform-sessions/:id/attendance/add" element={<SessionAttendanceAdd />} />
            <Route path="/platform-sessions/:id/reports" element={<SessionReports />} />
            <Route path="/platform-sessions/:id/reports/add" element={<SessionReportsAdd />} />
            <Route path="/platform-students" element={<PlatformStudentsList />} />
            <Route path="/platform-students/create" element={<PlatformStudentsCreate />} />
            <Route path="/platform-applicants" element={<PlatformApplicantsList />} />
            <Route path="/platform-applicants/create" element={<PlatformApplicantsCreate />} />
            <Route path="/platform-reports" element={<PlatformReports />} />
            <Route path="/mohfez-hours-report" element={<MohfezHoursReport />} />
            <Route path="/coordinator-workdays-report" element={<CoordinatorWorkdaysReport />} />
            <Route path="/student-absence-report" element={<StudentAbsenceReport />} />
            
            <Route path="/platform-announcements" element={<PlatformAnnouncements />} />
            <Route path="/platform-holidays" element={<PlatformHolidays />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/permissions" element={<PermissionsManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppDataProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/quran" element={<PublicQuran />} />
          <Route path="/IslamicStudies" element={<PublicIslamicStudies />} />
          <Route path="/login" element={<Login />} />
          <Route path="/live/:id" element={<LiveSession />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="/*" element={<DashboardLayout />} />
        </Routes>
      </Router>
    </AppDataProvider>
  );
}

export default App;
