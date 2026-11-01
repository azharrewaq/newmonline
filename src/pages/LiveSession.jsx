import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import JitsiMeeting from '../components/JitsiMeeting';
import { useAppData } from '../context/AppDataContext';
import { getJoinState } from '../utils/sessionHelpers';

/**
 * صفحة البث المدمج - تُفتح في تبويب جديد.
 * عند الدخول يتم تسجيل حضور الدارس / المحفظ / المنسق تلقائياً.
 */
function LiveSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { platformSessions, holidays, recordSessionJoin } = useAppData();
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const session = platformSessions.find(s => String(s.id) === String(id));
  const recordedRef = useRef(false);

  const isAdmin = currentUser?.role === 'admin';
  const joinState = session ? getJoinState(session, holidays) : { open: false, reason: '' };
  const allowed = !!session && (isAdmin || joinState.open);

  useEffect(() => {
    if (allowed && !recordedRef.current) {
      recordedRef.current = true;
      recordSessionJoin(session, currentUser);
    }
  }, [allowed, session, currentUser, recordSessionJoin]);

  const meeting = useMemo(() => session ? ({
    id: session.id,
    title: `حلقة ${session.session_no}`,
    teacher: session.mohfez,
    roomName: `Rowaq-Platform-Live-${session.id}`
  }) : null, [session]);

  if (!currentUser) return <Navigate to="/login" replace />;

  const closeTab = () => {
    window.close();
    // إذا لم يُغلق التبويب (لم يُفتح عبر window.open) نعود للحلقات
    setTimeout(() => navigate('/platform-sessions'), 300);
  };

  if (!session) {
    return (
      <div style={{ direction: 'rtl', textAlign: 'center', padding: '80px 20px', color: 'var(--text-primary)' }}>
        {platformSessions.length === 0 ? 'جاري تحميل بيانات الحلقة...' : 'الحلقة غير موجودة.'}
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ direction: 'rtl', textAlign: 'center', padding: '80px 20px', color: 'var(--text-primary)' }}>
        <h3 style={{ color: '#ef4444' }}>لا يمكن الدخول للحلقة الآن</h3>
        <p>{joinState.reason}</p>
        <button className="btn btn-outline" onClick={closeTab}>رجوع</button>
      </div>
    );
  }

  return <JitsiMeeting meeting={meeting} currentUser={currentUser} onClose={closeTab} loggedInStudent={null} />;
}

export default LiveSession;
