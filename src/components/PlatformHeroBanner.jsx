import React from 'react';
import './HeroBanner.css';
import { Crown } from 'lucide-react';

function PlatformHeroBanner() {
  return (
    <div className="hero-banner">
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <div className="welcome-tag">
          <Crown className="crown-icon text-gold" size={24} />
          <div>
            <h4>مرحباً بك في نظام إدارة المنصة</h4>
            <span className="university-name">الجامع الأزهر الشريف</span>
          </div>
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
