import React from 'react';
import './HeroBanner.css';
import { Crown } from 'lucide-react';

function PlatformHeroBanner() {
  return (
    <div className="hero-banner">
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <div className="welcome-tag" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Crown className="crown-icon text-gold" size={22} />
            <h4 style={{ margin: 0 }}>مرحباً بك في نظام إدارة المنصة</h4>
          </div>
          <span className="university-name" style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 4 }}>
            الجامع الأزهر الشريف
          </span>
        </div>
        
        <div className="main-title">
          <h1 className="font-calligraphy text-gold">لوحة التحكم المركزية</h1>
          <h2>برنامج إدارة المنصة الموحدة</h2>
        </div>
      </div>
    </div>
  );
}

export default PlatformHeroBanner;
