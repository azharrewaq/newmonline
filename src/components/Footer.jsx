import React from 'react';
import './Footer.css';

function Footer() {
  const activeSection = sessionStorage.getItem('activeSection');
  const isSharia = activeSection === 'sharia_arabic';
  const managerName = isSharia ? 'الشيخ / إبراهيم حلس' : 'الدكتور / مصطفى شيشي';
  const managerTitle = isSharia ? 'مدير إدارة الشؤون الدينية' : 'مدير شؤون الأروقة';

  return (
    <footer className="footer-section">
      {/* Top Row - Imam */}
      <div className="footer-imam-row">
        <div className="imam-card">
          <p className="care-text">برعاية كريمة من فضيلة الإمام الأكبر</p>
          <h2 className="imam-name">أ.د / أحمد الطيب</h2>
        </div>
      </div>

      {/* Bottom Row - Three Positions */}
      <div className="footer-grid">
        {/* Right Column - المشرف العام على الأروقة */}
        <div className="footer-card">
          <span className="footer-card-title">المشرف العام على الأروقة</span>
          <span className="footer-card-name">أ.د / عبدالمنعم فؤاد</span>
        </div>

        {/* Center Column - مدير عام الجامع الأزهر */}
        <div className="footer-card">
          <span className="footer-card-title">مدير عام الجامع الأزهر</span>
          <span className="footer-card-name">الدكتور / هاني عودة</span>
        </div>

        {/* Left Column - مدير شؤون الأروقة / الشؤون الدينية */}
        <div className="footer-card">
          <span className="footer-card-title">{managerTitle}</span>
          <span className="footer-card-name">{managerName}</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
