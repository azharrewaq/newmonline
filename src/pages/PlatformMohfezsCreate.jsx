import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';

function PlatformMohfezsCreate() {
  const { addPlatformMohfez, updatePlatformMohfez, platformMohfezs , rowaqs, users, addUser, updateUser } = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mohfezId = searchParams.get('id');
  const isEditing = !!mohfezId;
  
  const [form, setForm] = useState({
    name: '', email: '', phone: '', national_id: '', registry_no: '',
    job: '', workplace: '', job_grade: '', qualification: '', contest_date: '', status: '', address: '',
    rowaq: '', username: '', password: ''
  });

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm({ ...form, phone: value.replace(/\D/g, '') });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  useEffect(() => {
    if (isEditing && mohfezId) {
      const mohfezToEdit = platformMohfezs.find(m => String(m.id) === String(mohfezId));
      if (mohfezToEdit) {
        setForm({
          name: mohfezToEdit.name || '',
          email: mohfezToEdit.email || '',
          phone: mohfezToEdit.phone || '',
          national_id: mohfezToEdit.national_id || '',
          registry_no: mohfezToEdit.registry_no || '',
          job: mohfezToEdit.job || '',
          workplace: mohfezToEdit.workplace || '',
          job_grade: mohfezToEdit.job_grade || '',
          qualification: mohfezToEdit.qualification || '',
          contest_date: mohfezToEdit.contest_date || '',
          status: mohfezToEdit.status || '',
          address: mohfezToEdit.address || '',
          rowaq: mohfezToEdit.rowaq || '',
          username: mohfezToEdit.username || '',
          password: mohfezToEdit.password || ''
        });
      }
    }
  }, [isEditing, mohfezId, platformMohfezs]);

  const handleSubmit = () => {
    

    if (!form.name || !form.national_id || !form.phone) {
      alert('الرجاء إدخال الحقول الأساسية: (الاسم - الرقم القومي - رقم التليفون)');
      return;
    }

    // Check duplicate national ID
    const duplicateMohfez = platformMohfezs.find(m => 
      String(m.national_id).trim() === String(form.national_id).trim() && 
      (!isEditing || String(m.id) !== String(mohfezId))
    );
    if (duplicateMohfez) {
      alert('خطأ: الرقم القومي مسجل بالفعل لمحفظ آخر.');
      return;
    }

    const finalForm = {
      ...form,
      username: form.national_id,
      password: form.registry_no || form.national_id
    };
    
    const existingUser = users.find(u => u.national_id === form.national_id || u.email === form.national_id);

    if (isEditing) {
      updatePlatformMohfez(mohfezId, finalForm);
      if (existingUser) {
        updateUser(existingUser.id, {
          name: form.name,
          phone: form.phone,
          email: form.national_id,
          password: form.registry_no || form.national_id,
          national_id: form.national_id,
          record_number: form.registry_no || ''
        });
      } else {
        addUser({
          name: form.name,
          email: form.national_id,
          password: form.registry_no || form.national_id,
          phone: form.phone,
          role: 'platform_mohfez',
          national_id: form.national_id,
          record_number: form.registry_no || ''
        });
      }
      alert('تم تحديث المحفظ بنجاح');
    } else {
      addPlatformMohfez(finalForm);
      if (existingUser) {
        updateUser(existingUser.id, {
          name: form.name,
          phone: form.phone,
          role: 'platform_mohfez',
          email: form.national_id,
          national_id: form.national_id,
          record_number: form.registry_no || ''
        });
      } else {
        addUser({
          name: form.name,
          email: form.national_id,
          password: form.registry_no || form.national_id,
          phone: form.phone,
          role: 'platform_mohfez',
          national_id: form.national_id,
          record_number: form.registry_no || ''
        });
      }
      alert('تم إضافة المحفظ بنجاح');
    }
    navigate('/platform-mohfez');
  };

  return (
    <div className="management-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ textAlign: 'center', width: '100%' }}>{isEditing ? 'تعديل المحفظ' : 'إضافة محفظ جديد'}</h2>
      </div>

      <div className="form-wrapper box-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>المعلومات الأساسية</h3>
        
        <div className="form-grid" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="form-group">
            <label>الاسم <span className="req">*</span></label>
            <input name="name" type="text" className="form-input" placeholder="أدخل الاسم الكامل" value={form.name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input name="email" type="email" className="form-input" placeholder="example@email.com" value={form.email} onChange={handleChange} dir="ltr" />
          </div>
          
          <div className="form-group">
            <label>الرقم القومي <span className="req">*</span></label>
            <input name="national_id" type="text" className="form-input" placeholder="أدخل الرقم القومي" value={form.national_id} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>رقم الهاتف <span className="req">*</span></label>
            <div style={{ display: 'flex' }}>
               
               <input name="phone" type="text" className="form-input" placeholder="أدخل رقم الهاتف" value={form.phone} onChange={handleChange} style={{ borderRadius: '6px', flex: 1 }} dir="ltr"  />
            </div>
          </div>
          
          <div className="form-group">
            <label>رقم السجل</label>
            <input name="registry_no" type="text" className="form-input" placeholder="أدخل رقم السجل" value={form.registry_no} onChange={handleChange} />
          </div>
        </div>

        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>معلومات الوظيفة</h3>
        
        <div className="form-grid" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="form-group">
            <label>الوظيفة <span className="req">*</span></label>
            <input name="job" type="text" className="form-input" placeholder="أدخل الوظيفة" value={form.job} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>جهة العمل <span className="req">*</span></label>
            <input name="workplace" type="text" className="form-input" placeholder="أدخل جهة العمل" value={form.workplace} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>الدرجة الوظيفية <span className="req">*</span></label>
            <input name="job_grade" type="text" className="form-input" placeholder="أدخل الدرجة الوظيفية" value={form.job_grade} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>المؤهل <span className="req">*</span></label>
            <input name="qualification" type="text" className="form-input" placeholder="أدخل المؤهل" value={form.qualification} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>تاريخ المسابقة <span className="req">*</span></label>
            <input name="contest_date" type="date" className="form-input" value={form.contest_date} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>الحالة <span className="req">*</span></label>
            <select name="status" className="form-select" value={form.status} onChange={handleChange}>
              <option value="">اختار الحالة</option>
              <option value="مسّكن">مسّكن</option>
              <option value="اجازة">اجازة</option>
              <option value="اُخرى">اُخرى</option>
              <option value="معتذر">معتذر</option>
              <option value="انتظار">انتظار</option>
              <option value="مستبعد">مستبعد</option>
              <option value="موقوف">موقوف</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '30px' }}>
           <label>العنوان <span className="req">*</span></label>
           <textarea name="address" className="form-input textarea" placeholder="أدخل العنوان التفصيلي" value={form.address} onChange={handleChange}></textarea>
        </div>

        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>معلومات الرواق</h3>

        <div className="form-grid" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="form-group">
            <label>الرواق <span className="req">*</span></label>
            <select name="rowaq" className="form-select" value={form.rowaq} onChange={handleChange}>
              <option value="">اختار الرواق</option>
              <option value="رواق القرآن الكريم ( أطفال )">رواق القرآن الكريم ( أطفال )</option>
              <option value="رواق القرآن الكريم ( كبار )">رواق القرآن الكريم ( كبار )</option>
              <option value="رواق التجويد">رواق التجويد</option>
              <option value="رواق القراءات">رواق القراءات</option>
            </select>
          </div>
        </div>

      </div>

      <div className="form-actions" style={{ justifyContent: 'center', marginTop: '30px' }}>
        <button className="btn btn-primary" style={{ padding: '10px 40px' }} onClick={handleSubmit}>حفظ</button>
        <Link to="/platform-mohfez" className="btn btn-outline" style={{ textDecoration: 'none', padding: '10px 40px' }}>إلغاء</Link>
      </div>
    </div>
  );
}

export default PlatformMohfezsCreate;
