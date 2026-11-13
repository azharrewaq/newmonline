import React, { useState } from 'react';
import { Search, Filter, Edit, Trash2, User, Plus } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import egyptCenters from '../data/egyptCenters';

const roleLabels = {
  admin: 'أدمن (Admin)',
  rowaq_manager: 'مدير إدارة شؤون الأروقة',
  rowaq_tech: 'تقني إدارة شؤون الأروقة',
  rowaq_member: 'عضو إدارة شؤون الأروقة',
  branch_admin_coordinator: 'منسق إداري لفرع',
  branch_scientific_coordinator: 'منسق علمي لفرع',
  mohfez: 'محفظ شؤون الأروقة',
  platform_supervisor: 'مشرف المنصة',
  platform_coordinator: 'منسق المنصة',
  platform_mohfez: 'محفظ المنصة',
  student: 'دارس المنصة'
};

function UsersList() {
  const { users, deleteUser, addUser, updateUser, branches, sessions, platformSessions } = useAppData();
  
  // Get current user and role
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser ? currentUser.role : 'admin';

  const isSuperAdmin = role === 'admin';
  const isRowaqAdmin = role === 'rowaq_admin';
  const isRowaqManager = role === 'rowaq_manager';
  const isPlatformAdmin = role === 'platform_admin';
  const isPlatformSupervisor = role === 'platform_supervisor';

  const isAuthorized = isSuperAdmin || isRowaqAdmin || isRowaqManager || isPlatformAdmin || isPlatformSupervisor;

  const getAllowedRoles = () => {
    if (isSuperAdmin) {
      return [
        { value: 'admin', label: 'سوبر أدمن (Super Admin)', group: 'system' },
        { value: 'platform_admin', label: 'أدمن المنصة (Platform Admin)', group: 'platform' },
        { value: 'platform_supervisor', label: 'مشرف المنصة', group: 'platform' },
        { value: 'platform_coordinator', label: 'منسق المنصة', group: 'platform' },
        { value: 'platform_mohfez', label: 'محفظ المنصة', group: 'platform' },
        { value: 'student', label: 'دارس المنصة', group: 'platform' }
      ];
    }
    if (isPlatformAdmin) {
      return [
        { value: 'platform_supervisor', label: 'مشرف المنصة', group: 'platform' },
        { value: 'platform_coordinator', label: 'منسق المنصة', group: 'platform' },
        { value: 'platform_mohfez', label: 'محفظ المنصة', group: 'platform' },
        { value: 'student', label: 'دارس المنصة', group: 'platform' }
      ];
    }
    if (isPlatformSupervisor) {
      return [
        { value: 'platform_coordinator', label: 'منسق المنصة', group: 'platform' },
        { value: 'platform_mohfez', label: 'محفظ المنصة', group: 'platform' },
        { value: 'student', label: 'دارس المنصة', group: 'platform' }
      ];
    }
    return [];
  };

  const allowedRoles = getAllowedRoles();
  const defaultRole = allowedRoles[0]?.value || 'student';

  const [showFilters, setShowFilters] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterNationalId, setFilterNationalId] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalForm, setModalForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: defaultRole,
    national_id: '',
    record_number: '',
    userAdmin: '',
    userCenter: '',
    userBranch: '',
    userSession: ''
  });

  const platformRoles = ['admin', 'platform_admin', 'platform_supervisor', 'platform_coordinator', 'platform_mohfez', 'student'];
  const filtered = users.filter(u =>
    platformRoles.includes(u.role) &&
    (filterName ? u.name?.includes(filterName) : true) &&
    (filterEmail ? u.email?.includes(filterEmail) : true) &&
    (filterPhone ? u.phone?.includes(filterPhone) : true) &&
    (filterNationalId ? u.national_id?.includes(filterNationalId) : true)
  );

  const handleAddClick = () => {
    setEditingUser(null);
    setModalForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: defaultRole,
      national_id: '',
      record_number: '',
      userAdmin: '',
      userCenter: '',
      userBranch: '',
      userSession: ''
    });
    setShowModal(true);
  };

  const handleEditClick = (u) => {
    setEditingUser(u);
    setModalForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      phone: u.phone || '',
      role: u.role || defaultRole,
      national_id: u.national_id || '',
      record_number: u.record_number || '',
      userAdmin: u.userAdmin || '',
      userCenter: u.userCenter || '',
      userBranch: u.userBranch || '',
      userSession: u.userSession || ''
    });
    setShowModal(true);
  };

  const handleModalSave = () => {
    if (editingUser) {
      const isSystemAdmin = editingUser.role === 'admin' || editingUser.username === 'admin';

      if (!isSystemAdmin) {
        // في حالة التعديل: الاسم الكامل ورقم الهاتف فقط مطلوبان
        if (!modalForm.name || !modalForm.phone) {
          alert('يرجى ملء الاسم الكامل ورقم الهاتف على الأقل (*)');
          return;
        }
        if (modalForm.phone.length !== 11) {
          alert('رقم الهاتف يجب أن يكون مكوناً من 11 رقماً');
          return;
        }
      } else {
        if (!modalForm.name) {
          alert('يرجى ملء الاسم الكامل للأدمن (*)');
          return;
        }
      }
      
      // إعداد بيانات التحديث
      let updateData;
      if (isSystemAdmin) {
        updateData = {
          name: modalForm.name,
          role: 'admin',
          username: 'admin',
          email: 'admin',
          national_id: 'admin',
        };
        if (modalForm.password) {
          updateData.password = modalForm.password;
          updateData.record_number = modalForm.password; // تحديث record_number أيضاً لمنع الدخول بالباسورد القديم
          updateData.password_updated = true;
        }
      } else {
        updateData = {
          name: modalForm.name,
          phone: modalForm.phone,
          role: modalForm.role,
          userAdmin: modalForm.userAdmin,
          userCenter: modalForm.userCenter,
          userBranch: modalForm.userBranch,
          userSession: modalForm.userSession
        };
        
        // تحديث اليوزر (email) إذا تم تغييره
        if (modalForm.email) {
          updateData.email = modalForm.email;
          updateData.username = modalForm.email;
        }
        
        // تحديث كلمة المرور إذا أُدخلت (الأولوية لها وتُحدِّث رقم السجل أيضاً)
        if (modalForm.password) {
          updateData.password = modalForm.password;
          updateData.record_number = modalForm.password;
          updateData.password_updated = true;
        } else if (modalForm.record_number) {
          // تحديث رقم السجل فقط إذا لم تُدخل كلمة مرور جديدة
          updateData.record_number = modalForm.record_number;
          if (modalForm.record_number !== (editingUser.record_number || '')) {
            updateData.password = modalForm.record_number;
            updateData.password_updated = true;
          }
        }
        
        // تحديث الرقم القومي إذا أُدخل
        if (modalForm.national_id) {
          updateData.national_id = modalForm.national_id;
        }
      }
      
      updateUser(editingUser._id || editingUser.id, updateData);
      alert('✅ تم تحديث بيانات المستخدم بنجاح');
    } else {
      if (!modalForm.name || !modalForm.phone || !modalForm.national_id || !modalForm.record_number) {
        alert('يرجى ملء الاسم الكامل، رقم الهاتف، الرقم القومي، ورقم السجل (*)');
        return;
      }
      if (modalForm.phone.length !== 11) {
        alert('رقم الهاتف يجب أن يكون مكوناً من 11 رقماً');
        return;
      }
      
      const newUserData = {
        ...modalForm,
        email: modalForm.national_id,
        username: modalForm.national_id,
        password: modalForm.record_number
      };
      
      addUser(newUserData);
      alert('✅ تم إضافة المستخدم بنجاح.\nاسم المستخدم: ' + modalForm.national_id + '\nكلمة المرور: ' + modalForm.record_number);
    }
    setShowModal(false);
  };

  if (!isAuthorized) {
    return (
      <div className="management-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="box-card" style={{ textAlign: 'center', maxWidth: '500px', padding: '40px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '15px' }}>عذراً، ليس لديك صلاحية لعرض هذا القسم</h3>
          <p style={{ color: 'var(--text-secondary)' }}>يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="management-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="btn btn-outline" 
          onClick={() => setShowFilters(!showFilters)}
          style={{ height: '40px' }}
        >
          <Filter size={16} style={{ marginLeft: '5px' }} />
          {showFilters ? 'إخفاء أدوات البحث' : 'إظهار أدوات البحث'}
        </button>
        <div className="title-section" style={{ textAlign: 'right' }}>
          <h2>إدارة المستخدمين</h2>
          <p>إدارة وعرض قائمة المستخدمين المسجلين في النظام</p>
        </div>
      </div>

      {showFilters && (
        <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '15px' }}>
            <div className="form-group">
              <label>الاسم الكامل</label>
              <input type="text" className="form-input" placeholder="البحث بالاسم الكامل" value={filterName} onChange={e => setFilterName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input type="text" className="form-input" placeholder="البحث بالبريد الإلكتروني" value={filterEmail} onChange={e => setFilterEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="form-group">
              <label>رقم الهاتف</label>
              <input type="text" className="form-input" placeholder="البحث برقم الهاتف" value={filterPhone} onChange={e => setFilterPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="form-group">
              <label>الرقم القومي</label>
              <input type="text" className="form-input" placeholder="البحث بالرقم القومي" value={filterNationalId} onChange={e => setFilterNationalId(e.target.value)} />
            </div>
          </div>
          <div className="search-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-outline" onClick={() => { 
              setFilterName(''); setFilterEmail(''); setFilterPhone(''); setFilterNationalId(''); 
            }}>إعادة تعيين</button>
            <button className="btn btn-primary" style={{ marginRight: '10px' }}><Search size={16} /> بحث</button>
          </div>
        </div>
      )}

      {/* Table controls */}
      <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
        <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
           <button className="btn btn-primary" onClick={handleAddClick} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <Plus size={16} /> إضافة مستخدم
           </button>
        </div>
        <div className="table-stats">النتائج ({filtered.length})</div>
      </div>

      <div className="table-wrapper box-card">
        <table className="management-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'right' }}>المستخدم</th>
              <th style={{ textAlign: 'center' }}>معلومات الاتصال</th>
              <th style={{ textAlign: 'center' }}>النطاق الجغرافي / الحلقة</th>
              <th style={{ textAlign: 'center' }}>الدور</th>
              <th style={{ textAlign: 'center' }}>أنشئ في</th>
              <th style={{ textAlign: 'center' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  لا يوجد مستخدمين مسجلين.
                </td>
              </tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' 
                      }}>
                        <User size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          اليوزر: <span style={{ color: 'var(--accent-gold)' }}>{u.email}</span>
                        </div>
                        {(u.national_id || u.record_number) && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {u.national_id && `الرقم القومي: ${u.national_id}`}
                            {u.national_id && u.record_number && ' | '}
                            {u.record_number && `رقم السجل: ${u.record_number}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', direction: 'ltr' }}>{u.phone}</td>
                  <td style={{ textAlign: 'center' }}>
                    {u.userAdmin ? (
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{u.userAdmin}</span>
                        {u.userCenter && ` - ${u.userCenter}`}
                        {u.userBranch && ` (${u.userBranch})`}
                      </div>
                    ) : u.userSession ? (
                      <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 'bold' }}>
                        حلقة رقم: {u.userSession}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>عام (كامل النظام)</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{roleLabels[u.role] || u.role}</td>
                  <td style={{ textAlign: 'center' }}>إنشاء : {u.created_at}</td>
                  <td className="actions-cell" style={{ justifyContent: 'center' }}>
                    <button className="action-icon edit" onClick={() => handleEditClick(u)} title="تعديل"><Edit size={16}/></button>
                    <button className="action-icon delete" onClick={() => deleteUser(u.id)} title="حذف"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="box-card animate-float-1" style={{
            width: '90%',
            maxWidth: '500px',
            padding: '30px',
            position: 'relative',
            border: '1px solid var(--accent-gold)'
          }}>
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', color: 'var(--text-primary)', textAlign: 'right' }}>
              {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            
            <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
              <label>الاسم الكامل <span className="req">*</span></label>
              <input 
                type="text" className="form-input" placeholder="الاسم الكامل"
                value={modalForm.name} onChange={e => setModalForm({...modalForm, name: e.target.value})}
              />
            </div>

            {/* في حالة التعديل، نعرض حقول تغيير اسم المستخدم وكلمة المرور */}
            {editingUser && (
              <>
                {editingUser.role !== 'admin' && (
                  <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
                    <label>اسم المستخدم (اليوزر) <span className="req">*</span></label>
                    <input 
                      type="text" className="form-input" placeholder="اسم المستخدم أو البريد" dir="ltr" style={{ textAlign: 'right' }}
                      value={modalForm.email} onChange={e => setModalForm({...modalForm, email: e.target.value})}
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <label>كلمة المرور الجديدة (اتركه فارغاً للاحتفاظ بالحالية)</label>
                  <input 
                    type="password" className="form-input" placeholder="كلمة المرور الجديدة" dir="ltr" style={{ textAlign: 'right' }}
                    value={modalForm.password} onChange={e => setModalForm({...modalForm, password: e.target.value})}
                  />
                </div>
              </>
            )}

            {(!editingUser || editingUser.role !== 'admin') && (
              <>
                <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <label>رقم الهاتف <span className="req">*</span></label>
                  <input 
                    type="text" className="form-input" placeholder="رقم الهاتف (11 رقم)" dir="ltr" style={{ textAlign: 'right' }}
                    value={modalForm.phone} 
                    maxLength={11}
                    onChange={e => setModalForm({...modalForm, phone: e.target.value.replace(/\D/g, '')})}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <label>الرقم القومي {!editingUser && <span className="req">*</span>}</label>
                  <input 
                    type="text" className="form-input" placeholder="الرقم القومي (سيكون اسم المستخدم)"
                    value={modalForm.national_id} onChange={e => setModalForm({...modalForm, national_id: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <label>رقم السجل {!editingUser && <span className="req">*</span>}</label>
                  <input 
                    type="text" className="form-input" placeholder="رقم السجل (سيكون كلمة المرور)"
                    value={modalForm.record_number} onChange={e => setModalForm({...modalForm, record_number: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '25px', textAlign: 'right' }}>
                  <label>الدور <span className="req">*</span></label>
                  <select 
                    className="form-select"
                    value={modalForm.role} onChange={e => setModalForm({...modalForm, role: e.target.value})}
                  >
                    {allowedRoles.filter(r => r.group === 'system').map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                    {allowedRoles.some(r => r.group === 'rowaq') && (
                      <optgroup label="شؤون الأروقة">
                        {allowedRoles.filter(r => r.group === 'rowaq').map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </optgroup>
                    )}
                    {allowedRoles.some(r => r.group === 'platform') && (
                      <optgroup label="المنصة">
                        {allowedRoles.filter(r => r.group === 'platform').map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </>
            )}

            {/* 4. اختيار حلقة المنصة لمنسق/محفظ/دارس المنصة */}
            {['platform_mohfez', 'platform_coordinator', 'student'].includes(modalForm.role) && (
              <div className="form-group" style={{ marginBottom: '15px', textAlign: 'right' }}>
                <label>الحلقة المرتبطة (المنصة) <span className="req">*</span></label>
                <select 
                  className="form-select"
                  value={modalForm.userSession}
                  onChange={e => setModalForm({...modalForm, userSession: e.target.value})}
                >
                  <option value="">--- اختار الحلقة ---</option>
                  {platformSessions.map((s, i) => (
                    <option key={i} value={s.session_no}>
                      حلقة رقم {s.session_no} - {s.mohfez || 'غير محدد'} ({s.countries?.join('، ')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', flexDirection: 'row-reverse' }}>
              <button className="btn btn-primary" onClick={handleModalSave}>حفظ</button>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersList;
