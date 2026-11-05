import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { quranSurahs } from '../data/quranSurahs';
import {
  APPLICANT_ROWAQ_OPTIONS,
  getLevelsForApplicantRowaq,
  normalizeApplicantRowaq,
  PREFERRED_DAYS_OPTIONS,
  PREFERRED_TIME_OPTIONS,
} from '../utils/placementHelpers';

function PlatformApplicantsCreate() {
  const {
    addPlatformApplicant,
    updatePlatformApplicant,
    platformApplicants,
    placementGroups = [],
    platformMohfezs = [],
    platformCoordinators = [],
    users,
    addUser,
    updateUser
  } = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicantId = searchParams.get('id');
  const isEditing = !!applicantId;

  const [form, setForm] = useState({
    name: '',
    national_id: '',
    phone: '',
    rowaq: '',
    level: '',
    stopped_surah: '',
    preferred_days: '',
    preferred_time: '',
    group_no: '',
    mohfez: '',
    coordinator: '',
    exam_date: '',
    exam_time: '',
    teams_link: '',
    status: 'في انتظار الاختبار',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm(prev => ({ ...prev, phone: value.replace(/\D/g, '') }));
    } else if (name === 'rowaq') {
      setForm(prev => ({ ...prev, rowaq: value, level: '' }));
    } else if (name === 'group_no') {
      const grp = placementGroups.find(g => String(g.group_no) === String(value));
      setForm(prev => ({
        ...prev,
        group_no: value,
        mohfez: grp?.mohfez || prev.mohfez,
        coordinator: grp?.coordinator || prev.coordinator,
        exam_time: grp?.time_start || prev.exam_time,
        teams_link: grp?.teams_link || prev.teams_link,
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  useEffect(() => {
    if (isEditing && applicantId) {
      const a = platformApplicants.find(x => String(x.id) === String(applicantId));
      if (a) {
        setForm({
          name: a.name || '',
          national_id: a.national_id || a.passport_no || '',
          phone: a.phone || '',
          rowaq: normalizeApplicantRowaq(a.rowaq, a.gender) || '',
          level: a.level || '',
          stopped_surah: a.stopped_surah || '',
          preferred_days: a.preferred_days || '',
          preferred_time: a.preferred_time || '',
          group_no: a.group_no || '',
          mohfez: a.mohfez || '',
          coordinator: a.coordinator || '',
          exam_date: a.exam_date || '',
          exam_time: a.exam_time || '',
          teams_link: a.teams_link || '',
          status: a.status || 'في انتظار الاختبار',
        });
      }
    }
  }, [isEditing, applicantId, platformApplicants]);

  const availableLevels = getLevelsForApplicantRowaq(form.rowaq);

  const handleSubmit = () => {
    if (!form.name.trim() || !form.national_id.trim()) {
      alert('الرجاء إدخال الاسم والرقم القومي / جواز السفر');
      return;
    }

    const nid = String(form.national_id).trim();
    const duplicateApplicant = platformApplicants.find(a =>
      String(a.national_id || a.passport_no || '').trim() === nid &&
      (!isEditing || String(a.id) !== String(applicantId))
    );
    if (duplicateApplicant) {
      alert('خطأ: الرقم القومي / جواز السفر مسجل بالفعل لمتقدم آخر.');
      return;
    }

    const gender = form.rowaq.includes('سيدات') || form.rowaq.includes('نساء') ? 'أنثى' : (form.rowaq.includes('رجال') ? 'ذكر' : 'أطفال');
    const finalForm = {
      ...form,
      name: form.name.trim(),
      national_id: nid,
      passport_no: nid,
      gender,
      username: nid,
      password: nid,
      register_date: form.register_date || new Date().toLocaleDateString('ar-EG'),
    };

    const existingUser = users.find(u => String(u.national_id || u.email || '').trim() === nid);

    if (isEditing) {
      updatePlatformApplicant(applicantId, finalForm);
      if (existingUser) {
        updateUser(existingUser.id, {
          name: finalForm.name,
          phone: finalForm.phone,
          email: nid,
          password: nid,
          national_id: nid,
        });
      } else {
        addUser({
          name: finalForm.name,
          email: nid,
          password: nid,
          phone: finalForm.phone,
          role: 'student',
          national_id: nid,
        });
      }
      alert('تم تحديث بيانات المتقدم بنجاح');
    } else {
      addPlatformApplicant(finalForm);
      if (!existingUser) {
        addUser({
          name: finalForm.name,
          email: nid,
          password: nid,
          phone: finalForm.phone,
          role: 'student',
          national_id: nid,
        });
      }
      alert('تم إضافة المتقدم بنجاح');
    }
    navigate('/platform-applicants');
  };

  return (
    <div className="management-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ textAlign: 'center', width: '100%' }}>
          {isEditing ? 'تعديل بيانات المتقدم وتحديد المستوى' : 'إضافة متقدم جديد'}
        </h2>
      </div>

      <div className="form-wrapper box-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>
          البيانات الأساسية وتحديد المستوى
        </h3>

        <div className="form-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group">
            <label>الاسم <span className="req">*</span></label>
            <input name="name" type="text" className="form-input" placeholder="الاسم الكامل" value={form.name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>الرقم القومي أو جواز السفر <span className="req">*</span></label>
            <input name="national_id" type="text" className="form-input" placeholder="الرقم القومي / جواز السفر" value={form.national_id} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>رقم الهاتف (اختياري)</label>
            <input name="phone" type="text" className="form-input" placeholder="رقم الهاتف" value={form.phone} onChange={handleChange} dir="ltr" />
          </div>

          <div className="form-group">
            <label>الرواق</label>
            <select name="rowaq" className="form-select" value={form.rowaq} onChange={handleChange}>
              <option value="">--- اختر الرواق ---</option>
              {APPLICANT_ROWAQ_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>المستوى (مرتبط بنوع الرواق)</label>
            <select name="level" className="form-select" value={form.level} onChange={handleChange} disabled={!form.rowaq}>
              <option value="">{form.rowaq ? '--- اختر المستوى ---' : 'اختر الرواق أولاً'}</option>
              {availableLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>السورة المتوقف عندها الدارس</label>
            <select name="stopped_surah" className="form-select" value={form.stopped_surah} onChange={handleChange}>
              <option value="">--- اختر السورة ---</option>
              {quranSurahs.map(s => <option key={s.id} value={s.name}>{s.id} - سورة {s.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>الأيام المناسبة للدارس</label>
            <select name="preferred_days" className="form-select" value={form.preferred_days} onChange={handleChange}>
              <option value="">--- اختر اليومين ---</option>
              {PREFERRED_DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>التوقيت المناسب للدارس</label>
            <select name="preferred_time" className="form-select" value={form.preferred_time} onChange={handleChange}>
              <option value="">--- اختر التوقيت ---</option>
              {PREFERRED_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>حالة التقييم</label>
            <select name="status" className="form-select" value={form.status} onChange={handleChange}>
              <option value="في انتظار الاختبار">في انتظار الاختبار</option>
              <option value="تم تحديد المستوى">تم تحديد المستوى</option>
              <option value="غائب">غائب</option>
            </select>
          </div>
        </div>

        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>
          تسكين مجموعة ولجنة اختبار تحديد المستوى (يمكن تركها لاحقاً)
        </h3>

        <div className="form-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group">
            <label>رقم المجموعة (1 - 40)</label>
            <select name="group_no" className="form-select" value={form.group_no} onChange={handleChange}>
              <option value="">--- بدون مجموعة حالياً ---</option>
              <optgroup label="الفترة الأولى: من 6 إلى 8 مساءً (مجموعات 1 - 20)">
                {placementGroups.filter(g => g.group_no <= 20).map(g => (
                  <option key={g.group_no} value={g.group_no}>
                    مجموعة {g.group_no} {g.mohfez ? `(${g.mohfez})` : ''} — من 6 إلى 8 م
                  </option>
                ))}
              </optgroup>
              <optgroup label="الفترة الثانية: من 8 إلى 10 مساءً (مجموعات 21 - 40)">
                {placementGroups.filter(g => g.group_no > 20).map(g => (
                  <option key={g.group_no} value={g.group_no}>
                    مجموعة {g.group_no} {g.mohfez ? `(${g.mohfez})` : ''} — من 8 إلى 10 م
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="form-group">
            <label>المحفظ الممتحن</label>
            <select name="mohfez" className="form-select" value={form.mohfez} onChange={handleChange}>
              <option value="">--- اختر المحفظ ---</option>
              {platformMohfezs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>المنسق المشرف</label>
            <select name="coordinator" className="form-select" value={form.coordinator} onChange={handleChange}>
              <option value="">--- اختر المنسق ---</option>
              {platformCoordinators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>تاريخ يوم الاختبار</label>
            <input name="exam_date" type="date" className="form-input" value={form.exam_date} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>توقيت الاختبار (يظهر الرابط قبله بـ 15 د وبعده بـ 30 د)</label>
            <input name="exam_time" type="time" className="form-input" value={form.exam_time} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>رابط تيمز (Teams)</label>
            <input name="teams_link" type="text" className="form-input" placeholder="رابط اجتماع Teams" value={form.teams_link} onChange={handleChange} dir="ltr" />
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: 'center', marginTop: '30px' }}>
        <button className="btn btn-primary" style={{ padding: '10px 40px' }} onClick={handleSubmit}>حفظ</button>
        <Link to="/platform-applicants" className="btn btn-outline" style={{ textDecoration: 'none', padding: '10px 40px' }}>إلغاء</Link>
      </div>
    </div>
  );
}

export default PlatformApplicantsCreate;
