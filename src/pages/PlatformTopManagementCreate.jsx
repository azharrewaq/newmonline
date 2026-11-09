import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';

function PlatformTopManagementCreate() {
  const { addPlatformTopManagement, updatePlatformTopManagement, platformTopManagement, users, addUser, updateUser } = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('id');
  const isEditing = !!itemId;
  
  const [form, setForm] = useState({
    name: '', email: '', phone: '', national_id: '', registry_no: '',
    job: '', address: '', username: '', password: ''
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
    if (isEditing && itemId) {
      const itemToEdit = platformTopManagement.find(c => String(c.id) === String(itemId));
      if (itemToEdit) {
        setForm({
          name: itemToEdit.name || '',
          email: itemToEdit.email || '',
          phone: itemToEdit.phone || '',
          national_id: itemToEdit.national_id || '',
          registry_no: itemToEdit.registry_no || '',
          job: itemToEdit.job || '',
          address: itemToEdit.address || '',
          username: itemToEdit.username || '',
          password: itemToEdit.password || ''
        });
      }
    }
  }, [isEditing, itemId, platformTopManagement]);

  const handleSubmit = () => {
    

    if (!form.name || !form.national_id || !form.workplace || !form.job_grade) {
      alert('الرجاء ملء الحقول المطلوبة');
      return;
    }

    // Check duplicate national ID
    const duplicateMember = platformTopManagement.find(m => 
      String(m.national_id).trim() === String(form.national_id).trim() && 
      (!isEditing || String(m.id) !== String(itemId))
    );
    if (duplicateMember) {
      alert('خطأ: الرقم القومي مسجل بالفعل لعضو إدارة عليا آخر.');
      return;
    }

    const finalForm = {
      ...form,
      username: form.national_id,
      password: form.registry_no || form.national_id
    };
    
    const originalItem = isEditing && itemId ? platformTopManagement.find(m => String(m.id) === String(itemId) || String(m._id) === String(itemId)) : null;
    const oldNid = originalItem ? String(originalItem.national_id || '').trim() : '';
    const newNid = String(form.national_id || '').trim();
    const existingUser = users.find(u => {
      const uNid = String(u.national_id || u.username || u.email || '').trim();
      return (oldNid && uNid === oldNid) || (newNid && uNid === newNid);
    });

    if (isEditing) {
      updatePlatformTopManagement(itemId, finalForm);
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
          role: 'platform_admin',
          national_id: form.national_id,
          record_number: form.registry_no || ''
        });
      }
      alert('تم تحديث البيانات بنجاح');
    } else {
      addPlatformTopManagement(finalForm);
      if (existingUser) {
        updateUser(existingUser.id, {
          name: form.name,
          phone: form.phone,
          role: 'platform_admin',
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
          role: 'platform_admin',
          national_id: form.national_id,
          record_number: form.registry_no || ''
        });
      }
      alert('تم الإضافة بنجاح');
    }
    navigate('/platform-top-management');
  };

  return (
    <div className="management-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ textAlign: 'center', width: '100%' }}>{isEditing ? 'تعديل عضو الإدارة العليا' : 'إضافة عضو إدارة عليا جديد'}</h2>
      </div>

      <div className="form-wrapper box-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '10px', fontSize: '18px' }}>بيانات عضو الإدارة العليا</h3>
        
        <div className="form-grid" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="form-group">
            <label>الاسم <span className="req">*</span></label>
            <input name="name" type="text" className="form-input" placeholder="أدخل الاسم الكامل" value={form.name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>الوظيفة <span className="req">*</span></label>
            <input name="job" type="text" className="form-input" placeholder="أدخل الوظيفة" value={form.job} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>جهة العمل <span className="req">*</span></label>
            <input name="workplace" type="text" className="form-input" placeholder="أدخل جهة العمل" value={form.workplace} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>الرقم القومي <span className="req">*</span></label>
            <input name="national_id" type="text" className="form-input" placeholder="أدخل الرقم القومي" value={form.national_id} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>التليفون <span className="req">*</span></label>
            <input name="phone" type="text" className="form-input" placeholder="أدخل رقم التليفون" value={form.phone} onChange={handleChange} dir="ltr"  />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input name="email" type="email" className="form-input" placeholder="example@email.com" value={form.email} onChange={handleChange} dir="ltr" />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
           <label>العنوان</label>
           <textarea name="address" className="form-input textarea" placeholder="أدخل العنوان التفصيلي" value={form.address} onChange={handleChange}></textarea>
        </div>

      </div>

      <div className="form-actions" style={{ justifyContent: 'center', marginTop: '30px' }}>
        <button className="btn btn-primary" style={{ padding: '10px 40px' }} onClick={handleSubmit}>حفظ</button>
        <Link to="/platform-top-management" className="btn btn-outline" style={{ textDecoration: 'none', padding: '10px 40px' }}>إلغاء</Link>
      </div>

    </div>
  );
}

export default PlatformTopManagementCreate;
