import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Download, Upload, Edit, Trash2 } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportToXLSX, importFromXLSX } from '../utils/xlsxHelper';
import { filterCoordinatorsForUser } from '../utils/userScopeHelper';

function PlatformCoordinatorsList() {
  const { 
    platformCoordinators, 
    deletePlatformCoordinator, 
    addPlatformCoordinator, 
    addUser,
    hasPermission, 
    deleteAllPlatformCoordinators,
    platformSessions = [],
    platformMohfezs = [],
    platformStudents = [],
    users = []
  } = useAppData();
  const importRef = useRef(null);
  
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');

  const [filterName, setFilterName] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState('');

  // تصفية المنسقين وفق نطاق المستخدم (المنسق يرى نفسه فقط)
  const scopedCoordinators = useMemo(() => {
    return filterCoordinatorsForUser(platformCoordinators, currentUser, {
      platformSessions,
      platformMohfezs,
      platformStudents,
      users
    });
  }, [platformCoordinators, currentUser, platformSessions, platformMohfezs, platformStudents, users]);

  const filtered = scopedCoordinators.filter(c =>
    (filterName ? c.name?.includes(filterName) : true) &&
    (filterSpecialization ? c.specialization === filterSpecialization : true)
  );

  const handleExport = () => {
    const exportData = filtered.map(c => ({
      'الاسم': c.name || '',
      'الرقم القومي': c.national_id || '',
      'رقم التليفون': c.phone || '',
      'رقم السجل': c.registry_no || '',
      'التخصص': c.specialization || '',
      'رقم القرار': c.decision_no || '',
    }));
    exportToXLSX(exportData, 'المنسقين', 'منسقين المنصة');
  };

  const handleExportTemplate = () => {
    exportToXLSX([{
      'الاسم': '',
      'الرقم القومي': '',
      'رقم التليفون': '',
      'رقم السجل': '',
      'التخصص': '',
      'رقم القرار': '',
    }], 'نموذج_استيراد_المنسقين', 'نموذج');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      let importedCount = 0;
      rows.forEach((row, idx) => {
        const name = String(row['الاسم'] || row['اسم المنسق'] || '').trim();
        const national_id = String(row['الرقم القومي'] || row['الرقم القومى'] || '').trim();
        const phone = String(row['رقم التليفون'] || row['رقم الهاتف'] || row['الهاتف'] || row['التليفون'] || '').trim();
        if (!name || !national_id || !phone) return;
        const registry_no = String(row['رقم السجل'] || '').trim();
        addPlatformCoordinator({
          id: String(Date.now() + idx + Math.random()),
          name,
          national_id,
          phone,
          decision_no: String(row['رقم القرار'] || '').trim(),
          specialization: String(row['التخصص'] || '').trim(),
          registry_no,
          username: national_id,
          password: registry_no || national_id,
        });
        addUser({
          id: String(Date.now() + idx + Math.random()),
          name,
          email: national_id,
          username: national_id,
          password: registry_no || national_id,
          phone,
          role: 'platform_coordinator',
          national_id,
          record_number: registry_no || national_id,
        });
        importedCount++;
      });
      if (importedCount === 0) {
        alert('يرجى التأكد من وجود الأعمدة الأساسية في الملف: (الاسم - الرقم القومي - رقم التليفون)');
      } else {
        alert(`تم استيراد (${importedCount}) منسق بنجاح`);
      }
    } catch { alert('حدث خطأ في استيراد الملف'); }
    e.target.value = '';
  };

  if (!hasPermission('coordinators', 'view')) {
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
      <div className="page-header">
        <div className="title-section">
          <h2>المنسقين - المنصة</h2>
          <p>إدارة وعرض قائمة المنسقين الإداريين للمنصة</p>
        </div>
      </div>

      <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '20px' }}>
          <div className="form-group"><label>الاسم</label><input type="text" className="form-input" placeholder="البحث بالاسم" value={filterName} onChange={e => setFilterName(e.target.value)} /></div>
          <div className="form-group"><label>التخصص</label><select className="form-select" value={filterSpecialization} onChange={e => setFilterSpecialization(e.target.value)}><option value="">--- اختار التخصص ---</option><option value="إداري">إداري</option><option value="علمي">علمي</option></select></div>
        </div>
        <div className="search-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-outline" onClick={() => { setFilterName(''); setFilterSpecialization(''); }}>إعادة تعيين</button>
          <button className="btn btn-primary" style={{ marginRight: '10px' }}><Search size={16} /> بحث</button>
        </div>
      </div>

      <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
        <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
          {hasPermission('coordinators', 'add') && (
            <>
              <Link to="/platform-coordinators/create" className="btn btn-primary" style={{ textDecoration: 'none' }}><Plus size={16} /> إضافة منسق</Link>
              <button className="btn btn-gold-outline" onClick={() => importRef.current.click()}><Upload size={16} /> استيراد</button>
              <button className="btn btn-outline" onClick={handleExportTemplate}><Download size={16} /> تصدير نموذج</button>
              <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
            </>
          )}
          {hasPermission('coordinators', 'delete') && platformCoordinators.length > 0 && (
            <button className="btn btn-danger" onClick={deleteAllPlatformCoordinators}>
              حذف الجميع
            </button>
          )}
          <button className="btn btn-outline" onClick={handleExport}><Download size={16} /> تصدير</button>
        </div>
        <div className="table-stats">النتائج ({filtered.length})</div>
      </div>

      <div className="table-wrapper box-card">
        <table className="management-table">
          <thead><tr><th>الاسم</th><th>رقم القرار</th><th>التخصص</th><th>رقم السجل</th><th>الرقم القومي</th><th>الهاتف</th><th>الإجراءات</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>لا توجد بيانات.</td></tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td><td>{c.decision_no}</td><td>{c.specialization}</td><td>{c.registry_no}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{c.national_id}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{c.phone}</td>
                  <td className="actions-cell">
                    {hasPermission('coordinators', 'edit') && (
                      <Link to={`/platform-coordinators/create?id=${c.id}`} className="action-icon edit" style={{textDecoration: 'none', color: 'inherit'}}><Edit size={16}/></Link>
                    )}
                    {hasPermission('coordinators', 'delete') && (
                      <button className="action-icon delete" onClick={() => deletePlatformCoordinator(c.id)}><Trash2 size={16}/></button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlatformCoordinatorsList;
