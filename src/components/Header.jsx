import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Settings, Check, Globe } from 'lucide-react';
import './Header.css';
import { useAppData } from '../context/AppDataContext';
import { useAnnouncementNotifications } from '../utils/announcementHelpers';

function Header({ toggleSidebar }) {
  const { theme, toggleTheme } = useAppData();
  const { count: notifCount, manager } = useAnnouncementNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [currentLang, setCurrentLang] = useState('ar');
  const [notifications, setNotifications] = useState([
    { id: 1, text: "تم تسجيل طلب تقديم جديد في رواق القرآن", time: "منذ 5 دقائق", unread: true },
    { id: 2, text: "قام المحفظ أحمد علي بتسجيل حضور حلقة اليوم", time: "منذ ساعة", unread: true },
    { id: 3, text: "تقرير المتابعة الشهرية لفرع الجيزة جاهز للمراجعة", time: "منذ ساعتين", unread: false },
    { id: 4, text: "تحديث جديد في صلاحيات مدراء الأروقة", time: "منذ يوم", unread: false },
  ]);

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const userName = currentUser ? (currentUser.name || currentUser.username) : '';

  const notifRef = useRef(null);
  const langRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter(n => n.unread).length;


  return (
    <header className="app-header">
      <div className="header-left" style={{ display: 'flex', alignItems: 'center' }}>
        <button className="icon-btn text-muted" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <span style={{
          marginRight: '15px',
          backgroundColor: '#3b82f615',
          color: '#3b82f6',
          border: '1px solid #3b82f630',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 'bold',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6'
          }}></span>
          المنصة الإلكترونية
        </span>
        <Link to="/" className="primary-btn" style={{ textDecoration: 'none', marginRight: '15px' }}>
          الصفحة الرئيسية
        </Link>
      </div>
      
      <div className="header-right">
        {userName && (
          <span className="user-name-display" style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginLeft: '15px',
            marginRight: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '4px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)'
          }}>
            {userName}
          </span>
        )}
        {/* Theme Toggle */}
        <button className="icon-btn theme-toggle" onClick={toggleTheme} title="تغيير المظهر">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Language Selector */}
        <div className="lang-selector-container" ref={langRef} style={{ position: 'relative' }}>
          <button 
            className="icon-btn lang-btn" 
            onClick={() => setShowLangMenu(!showLangMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold' }}
            title="تغيير اللغة"
          >
            <Globe size={18} />
            <span>{currentLang === 'ar' ? 'AR' : 'EN'}</span>
          </button>
          
          {showLangMenu && (
            <div className="dropdown-menu lang-dropdown" style={{
              position: 'absolute', top: '100%', left: '0', 
              backgroundColor: 'var(--bg-lighter)', border: '1px solid var(--border-subtle)',
              borderRadius: '6px', padding: '6px 0', minWidth: '120px', zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '8px', textAlign: 'right'
            }}>
              <div 
                className="dropdown-item" 
                onClick={() => { setCurrentLang('ar'); setShowLangMenu(false); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: currentLang === 'ar' ? 'var(--accent-gold)' : 'var(--text-primary)',
                  backgroundColor: currentLang === 'ar' ? 'rgba(214, 175, 55, 0.1)' : 'transparent'
                }}
              >
                <span>العربية</span>
                {currentLang === 'ar' && <Check size={14} />}
              </div>
              <div 
                className="dropdown-item" 
                onClick={() => { alert('اللغة الإنجليزية ستكون متاحة قريباً في تحديث قادم!'); setShowLangMenu(false); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: currentLang === 'en' ? 'var(--accent-gold)' : 'var(--text-primary)'
                }}
              >
                <span>English</span>
                {currentLang === 'en' && <Check size={14} />}
              </div>
            </div>
          )}
        </div>



        {/* Announcements notifications */}
        {currentUser && ['admin', 'platform_admin', 'platform_supervisor', 'platform_coordinator', 'platform_mohfez', 'student'].includes(currentUser.role) && (
          <Link
            to="/platform-announcements"
            className="icon-btn"
            style={{ position: 'relative' }}
            title={notifCount > 0 ? (manager ? `${notifCount} رد جديد على الإعلانات` : `${notifCount} إعلان جديد`) : 'التعليمات والإعلانات'}
          >
            <Bell size={20} />
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff',
                borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
              }}>{notifCount}</span>
            )}
          </Link>
        )}

        {/* Settings Gear */}
        <Link to="/settings" className="icon-btn settings-btn" title="إعدادات النظام">
          <Settings size={20} />
        </Link>
      </div>
    </header>
  );
}

export default Header;
