import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Download, Upload, Edit, Trash2 } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportToXLSX, importFromXLSX } from '../utils/xlsxHelper';
import { filterSupervisorsForUser } from '../utils/userScopeHelper';

function PlatformSupervisorsList() {
  const { 
    platformSupervisors, 
    deletePlatformSupervisor, 
    addPlatformSupervisor, 
    deleteAllPlatformSupervisors,
    platformSessions = [],
    platformCoordinators = [],
    platformMohfezs = [],
    platformStudents = [],
    users = []
  } = useAppData();
  const importRef = useRef(null);
  
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser?.role || 'admin';
  const isAdmin = role === 'admin' || role === 'platform_admin';

  const [filterName, setFilterName] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState('');

  // تصفية المشرفين وفق نطاق المستخدم (المشرف يرى نفسه فقط، المدير يرى الجميع)
  const scopedSupervisors = useMemo(() => {
    return filterSupervisorsForUser(platformSupervisors, currentUser, {
      platformSessions,
      platformCoordinators,
      platformMohfezs,
      platformStudents,
      users
    });
  }, [platformSupervisors, currentUser, platformSessions, platformCoordinators, platformMohfezs, platformStudents, users]);

  const filtered = scopedSupervisors.filter(c =>
    (filterName ? c.name?.includes(filterName) : true) &&
    (filterSpecialization ? c.specialization === filterSpecialization : true)
  );

  const handleExport = () => {
    const exportData = filtered.map(c => ({
      'الاسم': c.name,
      'التخصص': c.specialization,
      'رقم السجل': c.registry_no,
      'الرقم القومي': c.national_id,
      'الهاتف': c.phone,
    }));
    exportToXLSX(exportData, 'المشرفين', 'إدارة المشرفين');
  };

  const handleExportTemplate = () => {
    exportToXLSX([{
      'الاسم': '',
      'التخصص': '',
      'رقم السجل': '',
      'الرقم القومي': '',
      'الهاتف': '',
    }], 'نموذج_استيراد_المشرفين', 'نموذج');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      rows.forEach(row => {
        addPlatformSupervisor({
          name: row['الاسم'] || '',
          specialization: row['التخصص'] || '',
          registry_no: row['رقم السجل'] || '',
          national_id: row['الرقم القومي'] || '',
          phone: row['الهاتف'] || '',
        });
      });
      alert('تم استيراد البيانات بنجاح');
    } catch {
      alert('حدث خطأ في استيراد الملف');
    }
    e.target.value = '';
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="title-section">
          <h2>المشرفين - المنصة</h2>
          <p>إدارة وعرض قائمة مشرفين المنصة</p>
        </div>
      </div>

      <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '20px' }}>
          <div className="form-group">
            <label>الاسم</label>
            <input type="text" className="form-input" placeholder="البحث بالاسم" value={filterName} onChange={e => setFilterName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>التخصص</label>
            <select className="form-select" value={filterSpecialization} onChange={e => setFilterSpecialization(e.target.value)}>
              <option value="">--- اختار التخصص ---</option>
              <option value="علمي">علمي</option>
              <option value="تقني">تقني</option>
              <option value="إداري">إداري</option>
            </select>
          </div>
        </div>
        <div className="search-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-outline" onClick={() => { setFilterName(''); setFilterSpecialization(''); }}>إعادة تعيين</button>
          <button className="btn btn-primary" style={{ marginRight: '10px' }}><Search size={16} /> بحث</button>
        </div>
      </div>

      <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
        <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
          {isAdmin && (
            <>
              <Link to="/platform-supervisors/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Plus size={16} /> إضافة مشرف
              </Link>
              <button className="btn btn-gold-outline" onClick={() => importRef.current.click()}>
                <Upload size={16} /> استيراد
              </button>
              <button className="btn btn-outline" onClick={handleExportTemplate}>
                <Download size={16} /> تصدير نموذج
              </button>
              <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
              {platformSupervisors.length > 0 && (
                <button className="btn btn-danger" onClick={deleteAllPlatformSupervisors}>
                  حذف الجميع
                </button>
              )}
            </>
          )}
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={16} /> تصدير
          </button>
        </div>
        <div className="table-stats">النتائج ({filtered.length})</div>
      </div>

      <div className="table-wrapper box-card">
        <table className="management-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>التخصص</th>
              <th>رقم السجل</th>
              <th>الرقم القومي</th>
              <th>الهاتف</th>
              {isAdmin && <th>الإجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? "6" : "5"} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  لا توجد بيانات.
                </td>
              </tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.specialization}</td>
                  <td>{c.registry_no}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{c.national_id}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{c.phone}</td>
                  {isAdmin && (
                    <td className="actions-cell">
                      <Link to={`/platform-supervisors/create?id=${c.id}`} className="action-icon edit" style={{textDecoration: 'none', color: 'inherit'}}><Edit size={16}/></Link>
                      <button className="action-icon delete" onClick={() => deletePlatformSupervisor(c.id)}><Trash2 size={16}/></button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlatformSupervisorsList;
