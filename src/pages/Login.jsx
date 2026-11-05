import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import './Auth.css';

// الأدوار التي تنتمي إلى نظام شئون الأروقة
const ROWAQ_ROLES = [
  'admin', 'rowaq_admin', 'rowaq_manager', 'rowaq_tech', 'rowaq_member',
  'branch_admin_coordinator', 'branch_scientific_coordinator', 'mohfez'
];

// الأدوار التي تنتمي إلى المنصة
const PLATFORM_ROLES = [
  'platform_admin', 'platform_supervisor', 'platform_coordinator',
  'platform_mohfez', 'student'
];

function getHomePageForRole(role) {
  if (!role) return '/dashboard';
  if (ROWAQ_ROLES.includes(role)) return '/dashboard';
  if (PLATFORM_ROLES.includes(role)) return '/platform-dashboard';
  return '/dashboard';
}

function Login() {
  const navigate = useNavigate();
  const {
    users, addUser,
    coordinators, mohfezs, managers,
    platformCoordinators, platformSupervisors, platformMohfezs, platformTopManagement,
    platformStudents, platformApplicants = []
  } = useAppData();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const inputUser = String(formData.username || '').trim();
    const inputPass = String(formData.password || '').trim();

    if (!inputUser || !inputPass) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      setLoading(false);
      return;
    }

    // ===== 1) البحث في قائمة المستخدمين أولاً =====
    let foundUser = users.find(u => {
      const ids = [u.national_id, u.email, u.username].map(v => String(v || '').trim());
      const pws = [u.password, u.record_number, u.registry_no].map(v => String(v || '').trim());
      return ids.some(id => id && id === inputUser) && pws.some(pw => pw && pw === inputPass);
    });

    // تحقق إضافي لدارسي العلوم الشرعية لتحديث دورهم أو التعرف عليهم مباشرة
    try {
      const shariaStudents = JSON.parse(localStorage.getItem('sharia_students') || '[]');
      const shariaMatch = shariaStudents.find(s => 
        String(s.nationalId || '').trim() === inputUser &&
        inputPass === String(s.nationalId || '').trim()
      );
      if (shariaMatch) {
        if (foundUser) {
          foundUser.role = 'sharia_student';
        } else {
          foundUser = {
            name: shariaMatch.name,
            email: shariaMatch.nationalId,
            username: shariaMatch.nationalId,
            national_id: shariaMatch.nationalId,
            password: shariaMatch.nationalId,
            record_number: shariaMatch.nationalId,
            phone: shariaMatch.phone || '',
            role: 'sharia_student',
            governorate: shariaMatch.governorate || '',
            created_at: new Date().toLocaleDateString('ar-EG')
          };
        }
      }
    } catch (err) {
      console.error('Error parsing sharia_students in Login', err);
    }

    const normalizeArabic = (str) => {
      if (!str) return '';
      return str
        .toString()
        .trim()
        .normalize('NFKD')
        .normalize('NFC')
        .replace(/ً/g, '')
        .replace(/ٌ/g, '')
        .replace(/ٍ/g, '')
        .replace(/َ/g, '')
        .replace(/ُ/g, '')
        .replace(/ِ/g, '')
        .replace(/ّ/g, '')
        .replace(/ْ/g, '')
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/[ة]/g, 'ه')
        .replace(/[ـ]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    };

    // ===== 2) إذا لم نجده، نبحث في جميع بيانات النظام، وإلا نقوم بتحديث الحقول الجغرافية إذا كان منسقاً أو محفظاً =====
    if (foundUser) {
      const nationalId = String(foundUser.national_id || foundUser.username || foundUser.email || '').trim();
      const mgr = managers.find(mg => String(mg.national_id || '').trim() === nationalId);
      if (mgr) {
        foundUser.specialty = mgr.specialty;
      }
      const coord = coordinators.find(c => 
        String(c.national_id || '').trim() === nationalId ||
        (foundUser.name && normalizeArabic(c.name) === normalizeArabic(foundUser.name))
      );
      if (coord) {
        foundUser.userAdmin = foundUser.userAdmin || coord.admin || '';
        foundUser.userCenter = foundUser.userCenter || coord.center || '';
        foundUser.userBranch = foundUser.userBranch || coord.branch || '';
        if (!foundUser.role) {
          foundUser.role = coord.specialization === 'إداري' ? 'branch_admin_coordinator' : 'branch_scientific_coordinator';
        }
      } else {
        const moh = mohfezs.find(m => 
          String(m.national_id || '').trim() === nationalId ||
          (foundUser.name && normalizeArabic(m.name) === normalizeArabic(foundUser.name))
        );
        if (moh) {
          foundUser.userAdmin = foundUser.userAdmin || moh.admin || '';
          foundUser.userCenter = foundUser.userCenter || moh.center || '';
          foundUser.userBranch = foundUser.userBranch || moh.branch || '';
          if (!foundUser.role) foundUser.role = 'mohfez';
        }
      }

      // إلحاق بيانات دارس المنصة وربطه بحلقته
      if (foundUser.role === 'student' || !foundUser.role) {
        const matchedStudent = platformStudents.find(st =>
          String(st.passport_no || st.national_id || '').trim() === nationalId ||
          (foundUser.name && normalizeArabic(st.name) === normalizeArabic(foundUser.name))
        );
        if (matchedStudent) {
          foundUser.role = 'student';
          foundUser.userSession = foundUser.userSession || matchedStudent.session_id || matchedStudent.session_no || '';
          if (!foundUser.name) foundUser.name = matchedStudent.name;
        }
      }

      // إلحاق اسم منسق المنصة أو محفظ المنصة إن لم يكن مسجلاً
      if (foundUser.role === 'platform_coordinator') {
        const pc = platformCoordinators.find(c =>
          String(c.national_id || '').trim() === nationalId ||
          (foundUser.name && normalizeArabic(c.name) === normalizeArabic(foundUser.name))
        );
        if (pc && !foundUser.name) foundUser.name = pc.name;
      }
      if (foundUser.role === 'platform_mohfez') {
        const pm = platformMohfezs.find(m =>
          String(m.national_id || '').trim() === nationalId ||
          (foundUser.name && normalizeArabic(m.name) === normalizeArabic(foundUser.name))
        );
        if (pm && !foundUser.name) foundUser.name = pm.name;
      }
    } else {
      console.log('🔍 لم يُعثر عليه في المستخدمين، جاري البحث في بيانات النظام...');

      // البحث في المنسقين (شئون الأروقة)
      const coord = coordinators.find(c =>
        String(c.national_id || '').trim() === inputUser &&
        String(c.registry_no || '').trim() === inputPass
      );
      if (coord) {
        const role = coord.specialization === 'إداري' ? 'branch_admin_coordinator' : 'branch_scientific_coordinator';
        foundUser = {
          name: coord.name, email: inputUser, username: inputUser, national_id: inputUser,
          password: inputPass, record_number: inputPass, phone: coord.phone || '',
          role, userAdmin: coord.admin || '', userCenter: coord.center || '', userBranch: coord.branch || ''
        };
      }

      // البحث في المحفظين (شئون الأروقة)
      if (!foundUser) {
        const moh = mohfezs.find(m =>
          String(m.national_id || '').trim() === inputUser &&
          String(m.registry_no || '').trim() === inputPass
        );
        if (moh) {
          foundUser = {
            name: moh.name, email: inputUser, username: inputUser, national_id: inputUser,
            password: inputPass, record_number: inputPass, phone: moh.phone || '',
            role: 'mohfez', userAdmin: moh.admin || '', userCenter: moh.center || '', userBranch: moh.branch || ''
          };
        }
      }

      // البحث في المدراء/أعضاء الإدارة
      if (!foundUser) {
        const mgr = managers.find(mg =>
          String(mg.national_id || '').trim() === inputUser &&
          String(mg.record_no || '').trim() === inputPass
        );
        if (mgr) {
          let role = 'rowaq_member';
          if (mgr.specialty === 'مدير الإدارة') role = 'rowaq_manager';
          else if (mgr.specialty === 'العضو التقني') role = 'rowaq_tech';
          foundUser = {
            name: mgr.name, email: inputUser, username: inputUser, national_id: inputUser,
            password: inputPass, record_number: inputPass, phone: mgr.phone || '',
            role, userAdmin: mgr.admin || '',
            specialty: mgr.specialty
          };
        }
      }

      // البحث في منسقي المنصة
      if (!foundUser) {
        const pc = platformCoordinators.find(c =>
          String(c.national_id || '').trim() === inputUser &&
          String(c.registry_no || '').trim() === inputPass
        );
        if (pc) {
          foundUser = {
            name: pc.name, email: inputUser, username: inputUser, national_id: inputUser,
            password: inputPass, record_number: inputPass, phone: pc.phone || '',
            role: 'platform_coordinator'
          };
        }
      }

      // البحث في مشرفي المنصة
      if (!foundUser) {
        const ps = platformSupervisors.find(s =>
          String(s.national_id || '').trim() === inputUser &&
          String(s.registry_no || '').trim() === inputPass
        );
        if (ps) {
          foundUser = {
            name: ps.name, email: inputUser, username: inputUser, national_id: inputUser,
            password: inputPass, record_number: inputPass, phone: ps.phone || '',
            role: 'platform_supervisor'
          };
        }
      }

      // البحث في محفظي المنصة
      if (!foundUser) {
        const pm = platformMohfezs.find(m =>
          String(m.national_id || '').trim() === inputUser &&
          String(m.registry_no || '').trim() === inputPass
        );
        if (pm) {
          foundUser = {
            name: pm.name, email: inputUser, username: inputUser, national_id: inputUser,
            password: inputPass, record_number: inputPass, phone: pm.phone || '',
            role: 'platform_mohfez'
          };
        }
      }

      // البحث في الإدارة العليا للمنصة
      if (!foundUser) {
        const pt = platformTopManagement.find(t =>
          String(t.national_id || '').trim() === inputUser &&
          (String(t.registry_no || '').trim() === inputPass || String(t.record_no || '').trim() === inputPass)
        );
        if (pt) {
          foundUser = {
            name: pt.name, email: inputUser, username: inputUser, national_id: inputUser,
            password: inputPass, record_number: inputPass, phone: pt.phone || '',
            role: 'platform_admin'
          };
        }
      }

      // البحث في دارسين المنصة (يستخدم رقم جواز السفر كاسم مستخدم وكلمة مرور)
      if (!foundUser) {
        const s = platformStudents.find(student =>
          String(student.passport_no || student.national_id || '').trim() === inputUser &&
          String(student.passport_no || student.national_id || '').trim() === inputPass
        );
        if (s) {
          const passport = String(s.passport_no || s.national_id || '').trim();
          foundUser = {
            name: s.name,
            email: passport,
            username: passport,
            national_id: passport,
            password: passport,
            record_number: passport,
            phone: s.phone || '',
            role: 'student',
            userSession: s.session_id || s.session_no || ''
          };
        }
      }

      // البحث في المتقدمين الجدد للمنصة (يستخدم الرقم القومي أو جواز السفر كاسم مستخدم وكلمة مرور)
      if (!foundUser) {
        const app = platformApplicants.find(a =>
          String(a.national_id || a.passport_no || '').trim() === inputUser &&
          String(a.national_id || a.passport_no || '').trim() === inputPass
        );
        if (app) {
          const nid = String(app.national_id || app.passport_no || '').trim();
          foundUser = {
            name: app.name,
            email: nid,
            username: nid,
            national_id: nid,
            password: nid,
            record_number: nid,
            phone: app.phone || '',
            role: 'student',
          };
        }
      }

      // إذا وجدناه في بيانات النظام، أنشئ حساب مستخدم له تلقائيًا
      if (foundUser) {
        console.log('✅ تم العثور عليه في بيانات النظام، جاري إنشاء حساب مستخدم...');
        addUser(foundUser);
      }
    }

    // ===== 3) تسجيل الدخول أو إظهار خطأ =====
    setTimeout(() => {
      if (foundUser) {
        const userToSave = { ...foundUser, id: foundUser.id || Date.now() };
        sessionStorage.setItem('currentUser', JSON.stringify(userToSave));
        setLoading(false);
        navigate('/platform-dashboard');
      } else {
        // عرض معلومات تشخيصية مفصلة
        console.log('❌ لم يتم العثور على المستخدم في أي مصدر بيانات');
        console.log('المدخل:', inputUser, '/', inputPass);
        console.log('عدد المستخدمين:', users.length);
        console.log('عدد المنسقين:', coordinators.length);
        console.log('عدد المحفظين:', mohfezs.length);
        console.log('عدد المدراء:', managers.length);
        
        // عرض المنسقين للمقارنة
        coordinators.forEach((c, i) => {
          console.log(`منسق[${i}]:`, {
            national_id: c.national_id,
            registry_no: c.registry_no,
            match_nid: String(c.national_id || '').trim() === inputUser,
            match_pw: String(c.registry_no || '').trim() === inputPass
          });
        });

        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="auth-container">
      <div className="auth-background"></div>
      
      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <h1>منصة الجامع الأزهر</h1>
            <p>تسجيل الدخول للمنصة</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-message" style={{ fontSize: '12px' }}>{error}</div>}

            <div className="form-group">
              <label htmlFor="username">اسم المستخدم (الرقم القومي)</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="أدخل الرقم القومي"
                required
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">كلمة المرور (رقم السجل)</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="أدخل رقم السجل"
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <Link to="#" className="forgot-password">هل نسيت كلمة المرور؟</Link>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
