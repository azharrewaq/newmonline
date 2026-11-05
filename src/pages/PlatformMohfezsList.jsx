import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Download, Upload, Edit, Trash2 } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportToXLSX, importFromXLSX } from '../utils/xlsxHelper';
import { filterMohfezsForUser } from '../utils/userScopeHelper';

function PlatformMohfezsList() {
  const { 
    platformMohfezs, 
    deletePlatformMohfez, 
    addPlatformMohfez, 
    addUser,
    hasPermission, 
    platformSessions, 
    deleteAllPlatformMohfezs,
    platformCoordinators = [],
    platformStudents = [],
    users = []
  } = useAppData();
  const importRef = useRef(null);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'مسّكن':
      case 'نشط':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        };
      case 'اجازة':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        };
      case 'معتذر':
        return {
          background: 'rgba(107, 114, 128, 0.15)',
          color: '#6b7280',
          border: '1px solid rgba(107, 114, 128, 0.3)'
        };
      case 'انتظار':
        return {
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        };
      case 'مستبعد':
      case 'غير نشط':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        };
      case 'موقوف':
        return {
          background: 'rgba(139, 92, 246, 0.15)',
          color: '#8b5cf6',
          border: '1px solid rgba(139, 92, 246, 0.3)'
        };
      case 'اُخرى':
        return {
          background: 'rgba(20, 184, 166, 0.15)',
          color: '#14b8a6',
          border: '1px solid rgba(20, 184, 166, 0.3)'
        };
      default:
        return {
          background: 'rgba(107, 114, 128, 0.15)',
          color: '#6b7280',
          border: '1px solid rgba(107, 114, 128, 0.3)'
        };
    }
  };
  
  // Get current user and role
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');

  const [filterName, setFilterName] = useState('');
  const [filterNationalId, setFilterNationalId] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // تصفية المحفظين وفق نطاق المستخدم (المنسق يرى محفظي حلقاته، المحفظ يرى نفسه فقط)
  const scopedMohfezs = useMemo(() => {
    return filterMohfezsForUser(platformMohfezs, currentUser, {
      platformSessions,
      platformCoordinators,
      platformStudents,
      users
    });
  }, [platformMohfezs, currentUser, platformSessions, platformCoordinators, platformStudents, users]);

  const filtered = scopedMohfezs.filter(m => {
    return (
      (filterName ? m.name?.includes(filterName) : true) &&
      (filterNationalId ? m.national_id?.includes(filterNationalId) : true) &&
      (filterEmail ? m.email?.includes(filterEmail) : true) &&
      (filterStatus ? m.status === filterStatus : true)
    );
  });

  const handleExport = () => {
    const exportData = filtered.map(m => ({
      'الاسم': m.name || '',
      'الرقم القومي': m.national_id || '',
      'رقم التليفون': m.phone || '',
      'رقم السجل': m.registry_no || '',
      'البريد الإلكتروني': m.email || '',
    }));
    exportToXLSX(exportData, 'المحفظين', 'محفظين المنصة');
  };

  const handleExportTemplate = () => {
    exportToXLSX([{
      'الاسم': '',
      'الرقم القومي': '',
      'رقم التليفون': '',
      'رقم السجل': '',
      'البريد الإلكتروني': '',
    }], 'نموذج_استيراد_المحفظين', 'نموذج');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      let importedCount = 0;
      rows.forEach((row, idx) => {
        const name = String(row['الاسم'] || row['اسم المحفظ'] || '').trim();
        const national_id = String(row['الرقم القومي'] || row['الرقم القومى'] || '').trim();
        const phone = String(row['رقم التليفون'] || row['رقم الهاتف'] || row['الهاتف'] || row['التليفون'] || '').trim();
        if (!name || !national_id || !phone) return;
        const registry_no = String(row['رقم السجل'] || '').trim();
        const itemId = String(Date.now() + idx + Math.random());
        addPlatformMohfez({
          id: itemId,
          name,
          national_id,
          phone,
          registry_no,
          contest_date: String(row['تاريخ المسابقة'] || '').trim(),
          rowaq: String(row['الرواق'] || '').trim(),
          email: String(row['البريد الإلكتروني'] || row['البريد الالكتروني'] || '').trim(),
          status: String(row['الحالة'] || 'نشط').trim(),
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
          role: 'platform_mohfez',
          national_id,
          record_number: registry_no || national_id,
        });
        importedCount++;
      });
      if (importedCount === 0) {
        alert('يرجى التأكد من وجود الأعمدة الأساسية في الملف: (الاسم - الرقم القومي - رقم التليفون)');
      } else {
        alert(`تم استيراد (${importedCount}) محفظ بنجاح`);
      }
    } catch {
      alert('حدث خطأ في استيراد الملف');
    }
    e.target.value = '';
  };

  if (!hasPermission('mohfezs', 'view')) {
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
          <h2>المحفظين - المنصة</h2>
          <p>إدارة وعرض قائمة محفظين المنصة</p>
        </div>
      </div>

      {/* Search Filters */}
      <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '15px' }}>
          <div className="form-group">
            <label>اسم المحفظ</label>
            <input type="text" className="form-input" placeholder="البحث باسم المحفظ" value={filterName} onChange={e => setFilterName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>الرقم القومي</label>
            <input type="text" className="form-input" placeholder="البحث بالرقم القومي" value={filterNationalId} onChange={e => setFilterNationalId(e.target.value)} />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input type="text" className="form-input" placeholder="البحث بالبريد الإلكتروني" value={filterEmail} onChange={e => setFilterEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>الحالة</label>
            <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">--- اختار الحالة ---</option>
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
        <div className="search-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-outline" onClick={() => { 
            setFilterName(''); setFilterNationalId(''); setFilterEmail(''); 
            setFilterStatus(''); 
          }}>إعادة تعيين</button>
          <button className="btn btn-primary" style={{ marginRight: '10px' }}><Search size={16} /> بحث</button>
        </div>
      </div>

      {/* Table controls */}
      <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
        <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
          {hasPermission('mohfezs', 'add') && (
            <>
              <Link to="/platform-mohfez/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Plus size={16} /> إضافة محفظ
              </Link>
              <button className="btn btn-gold-outline" onClick={() => importRef.current.click()}>
                <Upload size={16} /> استيراد
              </button>
              <button className="btn btn-outline" onClick={handleExportTemplate}>
                <Download size={16} /> تصدير نموذج
              </button>
              <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
            </>
          )}
          {hasPermission('mohfezs', 'delete') && platformMohfezs.length > 0 && (
            <button className="btn btn-danger" onClick={deleteAllPlatformMohfezs}>
              حذف الجميع
            </button>
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
              <th>اسم المحفظ</th>
              <th>الرقم القومي</th>
              <th>رقم التليفون</th>
              <th>رقم السجل</th>
              <th>تاريخ المسابقة</th>
              <th>الرواق</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  لا توجد بيانات.
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{m.national_id}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{m.phone || '-'}</td>
                  <td>{m.registry_no || '-'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{m.contest_date}</td>
                  <td>{m.rowaq}</td>
                  <td>
                    <span className="status-badge" style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      ...getStatusStyle(m.status)
                    }}>
                      {m.status || 'غير محدد'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {hasPermission('mohfezs', 'edit') && (
                      <Link to={`/platform-mohfez/create?id=${m.id}`} className="action-icon edit" style={{textDecoration: 'none', color: 'inherit'}}><Edit size={16}/></Link>
                    )}
                    {hasPermission('mohfezs', 'delete') && (
                      <button className="action-icon delete" onClick={() => deletePlatformMohfez(m.id)}><Trash2 size={16}/></button>
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

export default PlatformMohfezsList;
