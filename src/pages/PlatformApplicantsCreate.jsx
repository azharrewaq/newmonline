import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { quranSurahs } from '../data/quranSurahs';
import {
  APPLICANT_ROWAQ_OPTIONS,
  APPLICANT_GENDER_OPTIONS,
  GOVERNORATES_LIST,
  normalizeApplicantGender,
  getLevelsForApplicantRowaq,
  normalizeApplicantRowaq,
  normalizePreferredDays,
  PREFERRED_DAYS_OPTIONS,
  PREFERRED_TIME_OPTIONS,
  EXAM_TIME_OPTIONS,
  formatTime12Ar,
  normalizeExamDate,
  normalizeExamTime,
  isLegacyDefaultGroupShift,
  getGroupTimeLabel,
} from '../utils/placementHelpers';

function PlatformApplicantsCreate() {
  const {
    addPlatformApplicant,
    updatePlatformApplicant,
    platformApplicants,
    placementGroups = [],
    platformSupervisors = [],
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

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser?.role || 'admin';
  const isMohfez = role === 'platform_mohfez' || role === 'mohfez';
  const isScientificSupervisor = (() => {
    if (role === 'admin' || role === 'platform_admin') return false;
    if (isMohfez) return true;
    const uName = (currentUser?.name || '').trim();
    if (!uName) return false;
    if (role === 'platform_supervisor') {
      const supRec = (platformSupervisors || []).find(s => (s.name || '').trim() === uName);
      if (supRec?.specialization === 'علمي' || currentUser?.specialization === 'علمي') return true;
    }
    if ((platformMohfezs || []).some(m => (m.name || '').trim() === uName)) return true;
    if ((placementGroups || []).some(g => (g.scientific_supervisor || '').trim() === uName)) return true;
    return false;
  })();
  const hideStudentPhone = isMohfez || isScientificSupervisor;

  const [form, setForm] = useState({
    name: '',
    national_id: '',
    gender: '',
    governorate: '',
    phone: '',
    rowaq: '',
    level: '',
    applied_level: '',
    tested_level: '',
    stopped_surah: '',
    preferred_days: '',
    preferred_time: '',
    group_no: '',
    scientific_supervisor: '',
    technical_supervisor: '',
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
      const nextGender = value.includes('سيدات') || value.includes('نساء') ? 'أنثى' : (value.includes('رجال') ? 'ذكر' : '');
      setForm(prev => ({ ...prev, rowaq: value, gender: nextGender || prev.gender, level: '', applied_level: '', tested_level: '' }));
    } else if (name === 'applied_level') {
      setForm(prev => ({ ...prev, applied_level: value, level: prev.tested_level || value }));
    } else if (name === 'tested_level') {
      setForm(prev => ({ ...prev, tested_level: value, level: value || prev.applied_level }));
    } else if (name === 'group_no') {
      const grp = placementGroups.find(g => String(g.group_no) === String(value));
      setForm(prev => ({
        ...prev,
        group_no: value,
        scientific_supervisor: grp?.scientific_supervisor || prev.scientific_supervisor,
        technical_supervisor: grp?.technical_supervisor || prev.technical_supervisor,
        mohfez: grp?.mohfez || prev.mohfez,
        coordinator: grp?.coordinator || prev.coordinator,
        exam_time: (!isLegacyDefaultGroupShift(grp) && grp?.time_start) || prev.exam_time,
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
          gender: normalizeApplicantGender(a.gender, a.rowaq) || '',
          governorate: a.governorate || '',
          phone: a.phone || '',
          rowaq: normalizeApplicantRowaq(a.rowaq, a.gender) || '',
          level: a.level || '',
          applied_level: a.applied_level || a.level || '',
          tested_level: a.tested_level || '',
          stopped_surah: a.stopped_surah || '',
          preferred_days: normalizePreferredDays(a.preferred_days) || '',
          preferred_time: a.preferred_time || '',
          group_no: a.group_no || '',
          scientific_supervisor: a.scientific_supervisor || '',
          technical_supervisor: a.technical_supervisor || '',
          mohfez: a.mohfez || '',
          coordinator: a.coordinator || '',
          exam_date: normalizeExamDate(a.exam_date || ''),
          exam_time: normalizeExamTime(a.exam_time || ''),
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

    const gender = normalizeApplicantGender(form.gender, form.rowaq);
    const finalForm = {
      ...form,
      name: form.name.trim(),
      national_id: nid,
      passport_no: nid,
      gender,
      governorate: form.governorate || '',
      username: nid,
      password: nid,
      register_date: form.register_date || new Date().toLocaleDateString('ar-EG'),
    };

    const originalApplicant = isEditing && applicantId ? platformApplicants.find(a => String(a.id) === String(applicantId) || String(a._id) === String(applicantId)) : null;
    const oldNid = originalApplicant ? String(originalApplicant.national_id || originalApplicant.passport_no || '').trim() : '';

    const existingUser = users.find(u => {
      const uNid = String(u.national_id || u.username || u.email || '').trim();
      return (oldNid && uNid === oldNid) || (nid && uNid === nid);
    });

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
            <label>النوع (ذكر - أنثى)</label>
            <select name="gender" className="form-select" value={form.gender} onChange={handleChange}>
              <option value="">--- اختر النوع ---</option>
              {APPLICANT_GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>المحافظة</label>
            <select name="governorate" className="form-select" value={form.governorate} onChange={handleChange}>
              <option value="">--- اختر المحافظة ---</option>
              {GOVERNORATES_LIST.map(gov => <option key={gov} value={gov}>{gov}</option>)}
            </select>
          </div>
          {!hideStudentPhone && (
            <div className="form-group">
              <label>رقم التليفون</label>
              <input name="phone" type="text" className="form-input" placeholder="رقم التليفون" value={form.phone} onChange={handleChange} dir="ltr" />
            </div>
          )}

          <div className="form-group">
            <label>الرواق</label>
            <select name="rowaq" className="form-select" value={form.rowaq} onChange={handleChange}>
              <option value="">--- اختر الرواق ---</option>
              {APPLICANT_ROWAQ_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>المستوى وفق الاختبار (مرتبط بنوع الرواق)</label>
            <select name="tested_level" className="form-select" value={form.tested_level} onChange={handleChange} disabled={!form.rowaq}>
              <option value="">{form.rowaq ? '--- اختر المستوى وفق الاختبار ---' : 'اختر الرواق أولاً'}</option>
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
              <optgroup label="المجموعات 1 - 20">
                {placementGroups.filter(g => g.group_no <= 20).map(g => {
                  const lbl = getGroupTimeLabel(g);
                  return (
                    <option key={g.group_no} value={g.group_no}>
                      مجموعة {g.group_no} {g.mohfez ? `(${g.mohfez})` : ''}{lbl ? ` — ${lbl}` : ''}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="المجموعات 21 - 40">
                {placementGroups.filter(g => g.group_no > 20).map(g => {
                  const lbl = getGroupTimeLabel(g);
                  return (
                    <option key={g.group_no} value={g.group_no}>
                      مجموعة {g.group_no} {g.mohfez ? `(${g.mohfez})` : ''}{lbl ? ` — ${lbl}` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>

          <div className="form-group">
            <label>المشرف العلمي (من المحفظين)</label>
            <select name="scientific_supervisor" className="form-select" value={form.scientific_supervisor} onChange={handleChange}>
              <option value="">--- اختر المشرف العلمي (من المحفظين) ---</option>
              {platformMohfezs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>المشرف التقني (من المنسقين)</label>
            <select name="technical_supervisor" className="form-select" value={form.technical_supervisor} onChange={handleChange}>
              <option value="">--- اختر المشرف التقني (من المنسقين) ---</option>
              {platformCoordinators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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
            <select name="exam_time" className="form-select" value={String(form.exam_time || '').replace('.', ':')} onChange={handleChange} dir="ltr">
              <option value="">--- اختر توقيت الاختبار ---</option>
              {EXAM_TIME_OPTIONS.map(t => (
                <option key={t} value={t}>
                  {t.includes('-') ? `${t} (${formatTime12Ar(t)})` : `${t} (${formatTime12Ar(t)})`}
                </option>
              ))}
            </select>
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
