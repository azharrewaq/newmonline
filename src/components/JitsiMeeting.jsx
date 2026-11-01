import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Volume2, Mic, Video, Users, Clock, ShieldAlert } from 'lucide-react';

function JitsiMeeting({ meeting, currentUser, onClose, addLectureAccessLog, updateLectureAccessDuration, loggedInStudent }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const timerRef = useRef(null);
  
  const [duration, setDuration] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState(null);

  // Generate safe room name
  const cleanRoomName = (meeting.roomName || `Rowaq-Sharia-Live-${meeting.id}`)
    .replace(/[^a-zA-Z0-9-_]/g, ''); // Jitsi room names should be alphanumeric/dashes

  const isTeacher = ['sharia_teacher', 'admin', 'platform_mohfez', 'platform_coordinator'].includes(currentUser?.role);

  useEffect(() => {
    // 1. Check if external_api.js is loaded, otherwise load it
    const loadJitsiScript = () => {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('فشل تحميل خادم البث المباشر (Jitsi API)'));
        document.body.appendChild(script);
      });
    };

    loadJitsiScript()
      .then(() => {
        if (!containerRef.current) return;

        // Initialize Jitsi Meet Iframe
        const domain = 'meet.jit.si';
        const options = {
          roomName: cleanRoomName,
          width: '100%',
          height: '100%',
          parentNode: containerRef.current,
          userInfo: {
            displayName: currentUser?.name || 'زائر الرواق',
            email: currentUser?.email || ''
          },
          configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            prejoinConfig: {
              enabled: false
            },
            prejoinPageEnabled: false, // Skip prejoin for quick access
            disableDeepLinking: true,
            disableRemoteMute: !isTeacher,
            remoteVideoMenu: {
              disabled: !isTeacher,
              disableKick: !isTeacher,
              disableGrantModerator: !isTeacher,
              disableDemote: !isTeacher
            },
            // Teachers have moderation permissions, students are muted by default
            startAudioMuted: !isTeacher,
            startVideoMuted: !isTeacher,
            toolbarButtons: isTeacher ? [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'embedmeeting', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
              'tileview', 'select-background', 'download', 'help', 'mute-everyone',
              'mute-video-everyone', 'security', 'participants-pane'
            ] : [
              'microphone', 'camera', 'closedcaptions', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'tileview', 'select-background', 'help'
            ]
          },
          interfaceConfigOverwrite: {
            LANG_DETECTION: false,
            DEFAULT_BACKGROUND: '#1e1b4b',
            SHOW_CHROMECAST_BUTTON: false
          }
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        apiRef.current = api;

        // Add access log immediately when starting/joining
        if (loggedInStudent) {
          addLectureAccessLog({
            studentId: loggedInStudent.id,
            lectureId: String(meeting.id),
            durationMinutes: 0
          });
        }

        // Event Listeners
        api.addEventListener('videoConferenceJoined', () => {
          setIsJoined(true);
          
          // Start incrementing timer every 60 seconds (1 minute)
          timerRef.current = setInterval(() => {
            setDuration(prev => {
              const newDuration = prev + 1;
              if (loggedInStudent && updateLectureAccessDuration) {
                updateLectureAccessDuration(loggedInStudent.id, String(meeting.id), newDuration);
              }
              return newDuration;
            });
          }, 60000);
        });

        api.addEventListener('videoConferenceLeft', () => {
          setIsJoined(false);
          if (timerRef.current) clearInterval(timerRef.current);
          onClose();
        });
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      });

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [cleanRoomName, currentUser, meeting.id, isTeacher, loggedInStudent]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      fontFamily: 'inherit',
      direction: 'rtl'
    }}>
      {/* Top Bar / Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(90deg, #1e1b4b, #0f172a)'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-gold, #d6af37)', margin: 0, marginBottom: '4px' }}>
            {meeting.title}
          </h2>
          <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#94a3b8' }}>
            <span>المحاضر: <strong style={{ color: '#fff' }}>{meeting.teacher}</strong></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} />
              مدة التواجد: <strong style={{ color: '#10b981' }}>{duration} دقيقة</strong>
            </span>
            {isJoined && (
              <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="pulse-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                متصل بالبث المباشر
              </span>
            )}
          </div>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
        >
          <X size={16} />
          إنهاء ومغادرة
        </button>
      </div>

      {/* Main Container */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#020617' }}>
        {error ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            maxWidth: '400px',
            padding: '30px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px'
          }}>
            <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '15px' }} />
            <h4 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>خطأ في الاتصال</h4>
            <p style={{ color: '#cbd5e1', fontSize: '14px', margin: 0 }}>{error}</p>
          </div>
        ) : (
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>
    </div>
  );
}

export default JitsiMeeting;
