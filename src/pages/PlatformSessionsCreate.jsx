import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import TimePicker from '../components/TimePicker';
import { countriesList } from '../data/countries';
import { isPlatformManager } from '../utils/announcementHelpers';

const workDaysList = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const levelsForRowaq = {
  'رواق القرآن الكريم ( أطفال )': ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'مستوى الإتقان (تجويد) أطفال'],
  'رواق القرآن الكريم ( كبار )': ['نظام السنة الواحدة', 'نظام العامين', 'نظام الثلاث سنوات', 'نظام الاربع سنوات ( من سورة البقرة )', 'نظام الاربع سنوات ( من سورة الناس )', 'نظام الخمس سنوات ( من سورة البقرة )', 'نظام الخمس سنوات ( من سورة الناس )'],
  'رواق التجويد': ['التجويد ( تجويد )'],
  'رواق القراءات': ['قراءات ( الإفراد )', 'قراءات ( شرح أصول الشاطبية والدرة )']
};

function PlatformSessionsCreate() {
  const { addPlatformSession, updatePlatformSession, platformMohfezs, platformCoordinators, platformSessions, rowaqs } = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('id');
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const isEditing = !!sessionId;
  
  const [form, setForm] = useState({
    session_no: '', rowaq: '', level: '', mohfez: '', coordinator: '',
    student_type: '', attendance_type: 'عن بعد', time_start: '', time_end: '',
    workDays: [], countries: [], stream_type: 'external', teams_link: '', start_session_no: ''
  });

  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleRowaqChange = e => setForm({ ...form, rowaq: e.target.value, level: '' });

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day]
    }));
  };

  const toggleCountry = (country) => {
    setForm(prev => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter(c => c !== country)
        : [...prev.countries, country]
    }));
    setCountrySearch('');
  };

  useEffect(() => {
    if (isEditing && sessionId) {
      const sessionToEdit = platformSessions.find(s => String(s.id) === String(sessionId));
      if (sessionToEdit) {
        setForm({
          session_no: sessionToEdit.session_no || '',
          rowaq: sessionToEdit.rowaq || '',
          level: sessionToEdit.level || '',
          mohfez: sessionToEdit.mohfez || '',
          coordinator: sessionToEdit.coordinator || '',
          student_type: sessionToEdit.student_type || '',
          attendance_type: sessionToEdit.attendance_type || '',
          time_start: sessionToEdit.time_start || '',
          time_end: sessionToEdit.time_end || '',
          workDays: sessionToEdit.workDays || [],
          countries: sessionToEdit.countries || [],
          stream_type: sessionToEdit.stream_type || 'external',
          teams_link: sessionToEdit.teams_link || '',
          start_session_no: sessionToEdit.start_session_no || ''
        });
      }
    }
  }, [isEditing, sessionId, platformSessions]);

  const handleSubmit = () => {
    if (!form.session_no || !form.rowaq) {
      alert('الرجاء ملء الحقول المطلوبة');
      return;
    }
    if (isEditing) {
      updatePlatformSession(sessionId, form);
      alert('تم تحديث الحلقة بنجاح');
    } else {
      addPlatformSession(form);
      alert('تم إضافة الحلقة بنجاح');
    }
    navigate('/platform-sessions');
  };

  return (
    <div className="management-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ textAlign: 'center', width: '100%' }}>{isEditing ? 'تعديل حلقة المنصة' : 'إضافة حلقة منصة جديدة'}</h2>
      </div>

      <div className="form-wrapper box-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', fontSize: '18px' }}>معلومات الحلقة</h3>
        
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label>رقم الحلقة <span className="req">*</span></label>
          <input name="session_no" type="text" className="form-input" placeholder="أدخل رقم الحلقة" value={form.session_no} onChange={handleChange} />
        </div>

        {isPlatformManager(currentUser) && (
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>رقم جلسة البدء للحلقة</label>
            <input name="start_session_no" type="number" min="1" className="form-input" placeholder="1 (للحلقات الجارية فعلاً: أدخل رقم الجلسة التي ستبدأ منها التقارير)" value={form.start_session_no} onChange={handleChange} />
            <small style={{ color: 'var(--text-muted)' }}>يُرقَّم تقرير كل جلسة تلقائياً بدءاً من هذا الرقم.</small>
          </div>
        )}

        <div className="form-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {/* الدول */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label>الدولة <span className="req">*</span></label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text" className="form-input" placeholder="ابحث عن الدولة..."
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  onFocus={() => setShowCountryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                />
                {showCountryDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', zIndex: 10, marginTop: '4px' }}>
                    {countriesList.filter(c => !countrySearch || c.includes(countrySearch)).map(country => (
                      <div 
                        key={country} 
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseDown={(e) => { e.preventDefault(); toggleCountry(country); }}
                      >
                        {country}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ whiteSpace: 'nowrap', padding: '0 20px' }}
                onClick={() => {
                  if (countrySearch) {
                    // Add the country (whether it matches list or custom)
                    toggleCountry(countrySearch.trim());
                  }
                }}
              >
                إضافة دولة
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              {form.countries.map(c => (
                <span key={c} style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-subtle)' }}>
                  {c}
                  <button type="button" onClick={() => toggleCountry(c)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>&times;</button>
                </span>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label>الرواق <span className="req">*</span></label>
            <select name="rowaq" className="form-select" value={form.rowaq} onChange={handleRowaqChange}>
              <option value="">اختار الرواق</option>
              <option value="رواق القرآن الكريم ( أطفال )">رواق القرآن الكريم ( أطفال )</option>
              <option value="رواق القرآن الكريم ( كبار )">رواق القرآن الكريم ( كبار )</option>
              <option value="رواق التجويد">رواق التجويد</option>
              <option value="رواق القراءات">رواق القراءات</option>
            </select>
          </div>
          <div className="form-group">
            <label>المستوى <span className="req">*</span></label>
            <select name="level" className="form-select" value={form.level} onChange={handleChange}>
              <option value="">اختار المستوى</option>
              {form.rowaq && levelsForRowaq[form.rowaq] ? (
                levelsForRowaq[form.rowaq].map((level, i) => <option key={i} value={level}>{level}</option>)
              ) : (
                <option value="">اختار الرواق أولاً</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>المحفظ <span className="req">*</span></label>
            <select name="mohfez" className="form-select" value={form.mohfez} onChange={handleChange}>
              <option value="">اختار المحفظ</option>
              {platformMohfezs.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>المنسق المشرف</label>
            <select name="coordinator" className="form-select" value={form.coordinator} onChange={handleChange}>
              <option value="">اختار المنسق المشرف</option>
              {(platformCoordinators || []).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>تفاصيل الحلقة</h3>
        
        <div className="form-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(1, 1fr)' }}>
          <div className="form-group">
            <label>نوع الدارسين <span className="req">*</span></label>
            <select name="student_type" className="form-select" value={form.student_type} onChange={handleChange}>
              <option value="">اختار النوع</option>
              <option value="رجال">رجال</option>
              <option value="نساء">نساء</option>
              <option value="أطفال">أطفال</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label>نوع البث المباشر <span className="req">*</span></label>
          <select 
            name="stream_type" 
            className="form-select" 
            value={form.stream_type || 'external'} 
            onChange={(e) => setForm({ ...form, stream_type: e.target.value, teams_link: e.target.value === 'embedded' ? '' : form.teams_link })}
          >
            <option value="external">رابط خارجي (Microsoft Teams / Zoom / إلخ)</option>
            <option value="embedded">بث مدمج داخل الموقع (Jitsi Meet - مجاني وموصى به)</option>
          </select>
        </div>

        {(form.stream_type || 'external') === 'external' && (
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label>رابط الحلقة (تيمز/زوم)</label>
          <input name="teams_link" type="text" className="form-input" placeholder="أدخل رابط اجتماع الحلقة" value={form.teams_link} onChange={handleChange} />
        </div>
        )}

        <div className="form-grid" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="form-group">
            <label>وقت البداية <span className="req">*</span></label>
            <TimePicker name="time_start" value={form.time_start} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>وقت الانتهاء <span className="req">*</span></label>
            <TimePicker name="time_end" value={form.time_end} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '30px' }}>
          <label>أيام العمل <span className="req">*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            {workDaysList.map(day => (
              <label key={day} style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                background: form.workDays.includes(day) ? 'rgba(212,175,55,0.15)' : 'var(--bg-card)',
                border: `1px solid ${form.workDays.includes(day) ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s'
              }}>
                <input type="checkbox" checked={form.workDays.includes(day)} onChange={() => toggleDay(day)} style={{ display: 'none' }} />
                {day}
              </label>
            ))}
          </div>
        </div>

      </div>

      <div className="form-actions" style={{ justifyContent: 'center', marginTop: '30px' }}>
        <button className="btn btn-primary" style={{ padding: '10px 40px' }} onClick={handleSubmit}>حفظ</button>
        <Link to="/platform-sessions" className="btn btn-outline" style={{ textDecoration: 'none', padding: '10px 40px' }}>إلغاء</Link>
      </div>
    </div>
  );
}

export default PlatformSessionsCreate;
