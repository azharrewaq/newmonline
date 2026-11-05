import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, Trash2, Edit, Video,
  Users, Layers, GitMerge, Clock, Calendar
} from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportToXLSX, importFromXLSX } from '../utils/xlsxHelper';
import { quranSurahs } from '../data/quranSurahs';
import { normalizeArabic } from '../utils/userScopeHelper';
import {
  APPLICANT_ROWAQ_OPTIONS,
  getLevelsForApplicantRowaq,
  normalizeApplicantRowaq,
  PREFERRED_DAYS_OPTIONS,
  PREFERRED_TIME_OPTIONS,
  PLACEMENT_GROUP_CAPACITY,
  formatTime12Ar,
} from '../utils/placementHelpers';

function PlatformApplicantsList() {
  const {
    platformApplicants = [],
    deletePlatformApplicant,
    updatePlatformApplicant,
    deleteAllPlatformApplicants,
    bulkImportPlatformApplicants,
    placementGroups = [],
    updatePlacementGroup,
    platformMohfezs = [],
    platformCoordinators = [],
  } = useAppData();

  const importRef = useRef(null);
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const role = currentUser?.role || 'admin';
  const isMohfez = role === 'platform_mohfez' || role === 'mohfez';
  const isCoordinator = role === 'platform_coordinator';
  const isAdminOrSupervisor = ['admin', 'platform_admin', 'platform_supervisor'].includes(role);

  const [activeTab, setActiveTab] = useState('applicants'); // applicants | groups | compatible

  // فلاتر جدول المتقدمين
  const [filterName, setFilterName] = useState('');
  const [filterRowaq, setFilterRowaq] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGroupNo, setFilterGroupNo] = useState('');
  const [filterShift, setFilterShift] = useState(''); // '' | '6_8' | '8_10'
  const [filterExamDate, setFilterExamDate] = useState('');
  const [filterDays, setFilterDays] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // تحديد المجموعات التابعة للمحفظ أو المنسق الحالي
  const myGroupNumbers = useMemo(() => {
    if (isAdminOrSupervisor) return null; // يرى الجميع
    const uName = normalizeArabic(currentUser?.name || '');
    const nums = new Set();
    placementGroups.forEach(g => {
      if (isMohfez && g.mohfez && normalizeArabic(g.mohfez) === uName) nums.add(Number(g.group_no));
      if (isCoordinator && g.coordinator && normalizeArabic(g.coordinator) === uName) nums.add(Number(g.group_no));
    });
    return nums;
  }, [isAdminOrSupervisor, isMohfez, isCoordinator, currentUser, placementGroups]);

  // تصفية المتقدمين حسب صلاحية المستخدم (أدمن / منسق / محفظ) + الفلاتر
  const filtered = useMemo(() => {
    const uName = normalizeArabic(currentUser?.name || '');
    return platformApplicants.filter(a => {
      if (!isAdminOrSupervisor) {
        const gNo = Number(a.group_no);
        const byGroup = gNo && myGroupNumbers?.has(gNo);
        const byMohfez = isMohfez && a.mohfez && normalizeArabic(a.mohfez) === uName;
        const byCoord = isCoordinator && a.coordinator && normalizeArabic(a.coordinator) === uName;
        if (!byGroup && !byMohfez && !byCoord) return false;
      }

      if (filterName) {
        const q = filterName.trim();
        const matchName = (a.name || '').includes(q);
        const matchNid = String(a.national_id || a.passport_no || '').includes(q);
        if (!matchName && !matchNid) return false;
      }

      const normRowaq = normalizeApplicantRowaq(a.rowaq, a.gender);
      if (filterRowaq && normRowaq !== filterRowaq) return false;
      if (filterLevel && (a.level || '') !== filterLevel) return false;
      if (filterGroupNo && String(a.group_no || '') !== String(filterGroupNo)) return false;
      if (filterShift === '6_8' && !(Number(a.group_no) >= 1 && Number(a.group_no) <= 20)) return false;
      if (filterShift === '8_10' && !(Number(a.group_no) >= 21 && Number(a.group_no) <= 40)) return false;
      if (filterExamDate && String(a.exam_date || '').replace(/\//g, '-') !== filterExamDate) return false;
      if (filterDays && (a.preferred_days || '') !== filterDays) return false;
      if (filterTime && (a.preferred_time || '') !== filterTime) return false;

      return true;
    });
  }, [
    platformApplicants, isAdminOrSupervisor, isMohfez, isCoordinator,
    currentUser, myGroupNumbers, filterName, filterRowaq, filterLevel,
    filterGroupNo, filterShift, filterExamDate, filterDays, filterTime
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  // تحديث حقل للمتقدم مباشرة من الجدول (القوائم المنسدلة المترابطة)
  const handleInlineUpdate = (applicant, field, value) => {
    const patch = { [field]: value };
    if (field === 'rowaq') {
      patch.level = '';
      patch.gender = value === 'كبار نساء' ? 'أنثى' : (value === 'كبار رجال' ? 'ذكر' : 'أطفال');
    }
    if (field === 'group_no') {
      const grp = placementGroups.find(g => String(g.group_no) === String(value));
      if (grp) {
        patch.mohfez = grp.mohfez || applicant.mohfez || '';
        patch.coordinator = grp.coordinator || applicant.coordinator || '';
        patch.exam_time = grp.time_start || applicant.exam_time || '';
        patch.teams_link = grp.teams_link || applicant.teams_link || '';
      }
    }
    // إذا تم تحديد الرواق والمستوى والسورة نحدّث الحالة تلقائياً إلى "تم تحديد المستوى"
    const nextRowaq = field === 'rowaq' ? value : applicant.rowaq;
    const nextLevel = field === 'level' ? value : (field === 'rowaq' ? '' : applicant.level);
    const nextSurah = field === 'stopped_surah' ? value : applicant.stopped_surah;
    if (nextRowaq && nextLevel && nextSurah) {
      patch.status = 'تم تحديد المستوى';
    }
    updatePlatformApplicant(applicant.id, patch);
  };

  // تحديث بيانات إحدى المجموعات الـ 40 + عكسها على المتقدمين المسكنين فيها
  const handleGroupUpdate = (group, field, value) => {
    updatePlacementGroup(group.id, { [field]: value });
  };

  // تصدير جدول المتقدمين الحالي إلى Excel
  const handleExport = () => {
    if (isMohfez) return;
    const exportData = filtered.map(a => {
      const grp = placementGroups.find(g => Number(g.group_no) === Number(a.group_no));
      return {
        'الاسم': a.name || '',
        'الرقم القومي أو جواز السفر': a.national_id || a.passport_no || '',
        'الرواق': normalizeApplicantRowaq(a.rowaq, a.gender) || '',
        'المستوى': a.level || '',
        'السورة المتوقف عندها': a.stopped_surah || '',
        'الأيام المناسبة': a.preferred_days || '',
        'التوقيت المناسب': a.preferred_time || '',
        'رقم المجموعة': a.group_no || '',
        'فترة المجموعة': grp?.shift_label || '',
        'المحفظ': a.mohfez || grp?.mohfez || '',
        'المنسق': a.coordinator || grp?.coordinator || '',
        'تاريخ الاختبار': a.exam_date || '',
        'توقيت الاختبار': a.exam_time || grp?.time_start || '',
        'رابط تيمز': a.teams_link || grp?.teams_link || '',
        'الحالة': a.status || 'في انتظار الاختبار',
      };
    });
    exportToXLSX(exportData, 'المتقدمين_الجدد_تحديد_المستوى', 'المتقدمين الجدد');
  };

  // تصدير نموذج الاستيراد المعتمد
  const handleExportTemplate = () => {
    exportToXLSX([{
      'الاسم': '',
      'الرقم القومي أو جواز السفر': '',
      'الرواق': 'أطفال / كبار رجال / كبار نساء',
      'المستوى': '',
      'السورة المتوقف عندها': '',
      'الأيام المناسبة': 'سبت وثلاثاء / أحد وأربعاء / اثنين وخميس',
      'التوقيت المناسب': 'من 6 إلى 7 مساء / من 7 إلى 8 مساء / من 8 إلى 9 مساء / من 9 إلى 10 مساء',
      'رقم المجموعة': '',
      'المحفظ': '',
      'المنسق': '',
      'تاريخ الاختبار': '2026-11-10',
      'توقيت الاختبار': '18:00',
      'رابط تيمز': '',
    }], 'نموذج_استيراد_المتقدمين_الجدد', 'نموذج');
  };

  // استيراد دفعة كبيرة (حتى 6000 متقدم) من ملف Excel
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      if (!rows || rows.length === 0) {
        alert('الملف فارغ أو يحتوي على بيانات غير صالحة');
        return;
      }

      const existingIds = new Set(
        platformApplicants.map(a => String(a.national_id || a.passport_no || '').trim()).filter(Boolean)
      );

      const newApplicants = [];
      const newUsers = [];

      rows.forEach((row, idx) => {
        const nid = String(
          row['الرقم القومي أو جواز السفر'] ||
          row['الرقم القومي او جواز السفر'] ||
          row['الرقم القومي'] ||
          row['رقم جواز السفر'] ||
          ''
        ).trim();
        const name = String(row['الاسم'] || '').trim();
        if (!nid && !name) return;
        if (nid && existingIds.has(nid)) return;
        if (nid) existingIds.add(nid);

        const rawRowaq = row['الرواق'] || '';
        const rawGender = row['الجنس'] || '';
        const normRowaq = normalizeApplicantRowaq(rawRowaq, rawGender);
        const level = String(row['المستوى'] || '').trim();
        const stoppedSurah = String(row['السورة المتوقف عندها'] || row['السورة'] || '').replace(/^سورة\s+/, '').trim();
        const preferredDays = String(row['الأيام المناسبة'] || row['الايام المناسبة'] || '').trim();
        const preferredTime = String(row['التوقيت المناسب'] || '').trim();

        const groupNoRaw = row['رقم المجموعة'] || row['المجموعة'] || '';
        const groupNo = groupNoRaw ? Number(groupNoRaw) : '';
        const matchedGroup = groupNo ? placementGroups.find(g => Number(g.group_no) === Number(groupNo)) : null;

        const mohfez = String(row['المحفظ'] || matchedGroup?.mohfez || '').trim();
        const coordinator = String(row['المنسق'] || matchedGroup?.coordinator || '').trim();
        const examDate = String(row['تاريخ الاختبار'] || '').trim();
        const examTime = String(row['توقيت الاختبار'] || matchedGroup?.time_start || (groupNo > 20 ? '20:00' : (groupNo >= 1 ? '18:00' : ''))).trim();
        const teamsLink = String(row['رابط تيمز'] || row['رابط الحلقة'] || matchedGroup?.teams_link || '').trim();
        const phone = String(row['الهاتف'] || row['رقم الهاتف'] || '').trim();

        const id = String(Date.now() + idx + Math.random());
        const gender = normRowaq === 'كبار نساء' ? 'أنثى' : (normRowaq === 'كبار رجال' ? 'ذكر' : 'أطفال');

        newApplicants.push({
          id,
          name,
          national_id: nid,
          passport_no: nid,
          phone,
          rowaq: APPLICANT_ROWAQ_OPTIONS.includes(normRowaq) ? normRowaq : '',
          gender,
          level,
          stopped_surah: stoppedSurah,
          preferred_days: preferredDays,
          preferred_time: preferredTime,
          group_no: groupNo,
          mohfez,
          coordinator,
          exam_date: examDate,
          exam_time: examTime,
          teams_link: teamsLink,
          status: (normRowaq && level && stoppedSurah) ? 'تم تحديد المستوى' : 'في انتظار الاختبار',
          username: nid,
          password: nid,
          register_date: row['تاريخ التسجيل'] || new Date().toLocaleDateString('ar-EG'),
        });

        if (nid) {
          newUsers.push({
            id: String(Date.now() + idx + Math.random()),
            name,
            email: nid,
            username: nid,
            password: nid,
            record_number: nid,
            phone,
            role: 'student',
            national_id: nid,
          });
        }
      });

      if (newApplicants.length === 0) {
        alert('لم يتم العثور على سجلات جديدة للاستيراد (أو جميع الأرقام القومية مكررة).');
        e.target.value = '';
        return;
      }

      await bulkImportPlatformApplicants(newApplicants, newUsers);
      alert(`تم استيراد (${newApplicants.length}) متقدم بنجاح`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء استيراد الملف');
    }
    e.target.value = '';
  };

  // تجميع المتقدمين المتوافقين في المستوى والرواق والسورة والأيام والتوقيت لدمجهم في الحلقات الأصلية لاحقاً
  const compatibleBuckets = useMemo(() => {
    const map = {};
    platformApplicants.forEach(a => {
      const r = normalizeApplicantRowaq(a.rowaq, a.gender);
      if (!r || !a.level) return;
      const key = `${r} || ${a.level} || ${a.stopped_surah || 'غير محدد'} || ${a.preferred_days || 'غير محدد'} || ${a.preferred_time || 'غير محدد'}`;
      if (!map[key]) {
        map[key] = {
          key,
          rowaq: r,
          level: a.level,
          stopped_surah: a.stopped_surah || '-',
          preferred_days: a.preferred_days || '-',
          preferred_time: a.preferred_time || '-',
          members: [],
        };
      }
      map[key].members.push(a);
    });
    return Object.values(map).sort((a, b) => b.members.length - a.members.length);
  }, [platformApplicants]);

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="title-section">
          <h2>المتقدمون الجدد وخطة تحديد المستوى</h2>
          <p>
            40 مجموعة يومياً (25 دارساً للمجموعة): 20 مجموعة من 6 إلى 8 مساءً • 20 مجموعة من 8 إلى 10 مساءً
          </p>
        </div>
      </div>

      {/* شريط التبويبات */}
      <div className="box-card" style={{ display: 'flex', gap: 10, padding: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'applicants' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('applicants')}
        >
          <Users size={16} /> جدول المتقدمين وتحديد المستوى ({filtered.length})
        </button>
        <button
          className={`btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('groups')}
        >
          <Layers size={16} /> المجموعات اليومية الـ 40 (20 من 6-8 م | 20 من 8-10 م)
        </button>
        {isAdminOrSupervisor && (
          <button
            className={`btn ${activeTab === 'compatible' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('compatible')}
          >
            <GitMerge size={16} /> المجموعات المتوافقة للدمج في الحلقات الأصلية ({compatibleBuckets.length})
          </button>
        )}
      </div>

      {/* ───────── التبويب الأول: جدول المتقدمين الجدد وتحديد المستوى ───────── */}
      {activeTab === 'applicants' && (
        <>
          <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 15 }}>
              <div className="form-group">
                <label>الاسم أو الرقم القومي/الجواز</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ابحث بالاسم أو الرقم..."
                  value={filterName}
                  onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="form-group">
                <label>الرواق</label>
                <select
                  className="form-select"
                  value={filterRowaq}
                  onChange={e => { setFilterRowaq(e.target.value); setFilterLevel(''); setCurrentPage(1); }}
                >
                  <option value="">--- كل الأروقة ---</option>
                  {APPLICANT_ROWAQ_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>المستوى</label>
                <select
                  className="form-select"
                  value={filterLevel}
                  onChange={e => { setFilterLevel(e.target.value); setCurrentPage(1); }}
                  disabled={!filterRowaq}
                >
                  <option value="">{filterRowaq ? '--- كل المستويات ---' : 'اختر الرواق أولاً'}</option>
                  {getLevelsForApplicantRowaq(filterRowaq).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>الفترة / المجموعة</label>
                <select
                  className="form-select"
                  value={filterGroupNo}
                  onChange={e => { setFilterGroupNo(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل المجموعات (1 - 40) ---</option>
                  <optgroup label="الفترة الأولى: من 6 إلى 8 مساءً (1 - 20)">
                    {placementGroups.filter(g => g.group_no <= 20).map(g => (
                      <option key={g.group_no} value={g.group_no}>
                        مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="الفترة الثانية: من 8 إلى 10 مساءً (21 - 40)">
                    {placementGroups.filter(g => g.group_no > 20).map(g => (
                      <option key={g.group_no} value={g.group_no}>
                        مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <label>فترة الاختبار</label>
                <select
                  className="form-select"
                  value={filterShift}
                  onChange={e => { setFilterShift(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- كل الفترتين ---</option>
                  <option value="6_8">من 6 إلى 8 مساءً (مجموعات 1 - 20)</option>
                  <option value="8_10">من 8 إلى 10 مساءً (مجموعات 21 - 40)</option>
                </select>
              </div>

              <div className="form-group">
                <label>تاريخ يوم الاختبار</label>
                <input
                  type="date"
                  className="form-input"
                  value={filterExamDate}
                  onChange={e => { setFilterExamDate(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="form-group">
                <label>الأيام المناسبة للدارس</label>
                <select
                  className="form-select"
                  value={filterDays}
                  onChange={e => { setFilterDays(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- الكل ---</option>
                  {PREFERRED_DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>التوقيت المناسب للدارس</label>
                <select
                  className="form-select"
                  value={filterTime}
                  onChange={e => { setFilterTime(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">--- الكل ---</option>
                  {PREFERRED_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="search-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setFilterName(''); setFilterRowaq(''); setFilterLevel('');
                  setFilterGroupNo(''); setFilterShift(''); setFilterExamDate('');
                  setFilterDays(''); setFilterTime(''); setCurrentPage(1);
                }}
              >
                إعادة تعيين
              </button>
              <button className="btn btn-primary" style={{ marginRight: 10 }}>
                <Search size={16} /> بحث
              </button>
            </div>
          </div>

          <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
            <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
              {isAdminOrSupervisor && (
                <>
                  <Link to="/platform-applicants/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    <Plus size={16} /> إضافة متقدم
                  </Link>
                  <button className="btn btn-gold-outline" onClick={() => importRef.current.click()}>
                    <Upload size={16} /> استيراد من إكسيل
                  </button>
                  <button className="btn btn-outline" onClick={handleExportTemplate}>
                    <Download size={16} /> تصدير نموذج الإكسيل
                  </button>
                  <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
                  {platformApplicants.length > 0 && (
                    <button className="btn btn-danger" onClick={deleteAllPlatformApplicants}>
                      حذف الجميع
                    </button>
                  )}
                </>
              )}
              {!isMohfez && (
                <button className="btn btn-outline" onClick={handleExport}>
                  <Download size={16} /> تصدير
                </button>
              )}
            </div>
            <div className="table-stats">
              إجمالي النتائج ({filtered.length}) — صفحة {currentPage} من {totalPages}
            </div>
          </div>

          <div className="table-wrapper box-card">
            <table className="management-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>م</th>
                  <th style={{ textAlign: 'center' }}>الاسم</th>
                  {!isMohfez && <th style={{ textAlign: 'center' }}>الرقم القومي / جواز السفر</th>}
                  <th style={{ textAlign: 'center' }}>الرواق</th>
                  <th style={{ textAlign: 'center' }}>المستوى</th>
                  <th style={{ textAlign: 'center' }}>السورة المتوقف عندها</th>
                  <th style={{ textAlign: 'center' }}>الأيام المناسبة</th>
                  <th style={{ textAlign: 'center' }}>التوقيت المناسب</th>
                  <th style={{ textAlign: 'center' }}>المجموعة</th>
                  <th style={{ textAlign: 'center' }}>تاريخ وتوقيت الاختبار</th>
                  <th style={{ textAlign: 'center' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={isMohfez ? 10 : 11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      لا توجد بيانات متقدمين حالياً (سيتم تسكين ورفع بيانات الدارسين لاحقاً).
                    </td>
                  </tr>
                ) : (
                  paginated.map((a, idx) => {
                    const rowRowaq = normalizeApplicantRowaq(a.rowaq, a.gender);
                    const rowLevels = getLevelsForApplicantRowaq(rowRowaq);
                    const grp = placementGroups.find(g => Number(g.group_no) === Number(a.group_no));
                    const link = a.teams_link || grp?.teams_link || '';
                    return (
                      <tr key={a.id}>
                        <td style={{ textAlign: 'center' }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{a.name}</td>
                        {!isMohfez && (
                          <td style={{ direction: 'ltr', textAlign: 'center' }}>{a.national_id || a.passport_no || '-'}</td>
                        )}

                        {/* الرواق - قائمة منسدلة */}
                        <td style={{ minWidth: 140 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={rowRowaq}
                            onChange={e => handleInlineUpdate(a, 'rowaq', e.target.value)}
                          >
                            <option value="">-- الرواق --</option>
                            {APPLICANT_ROWAQ_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>

                        {/* المستوى المرتبط بنوع الرواق */}
                        <td style={{ minWidth: 190 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.level || ''}
                            disabled={!rowRowaq}
                            onChange={e => handleInlineUpdate(a, 'level', e.target.value)}
                          >
                            <option value="">{rowRowaq ? '-- اختر المستوى --' : 'اختر الرواق أولاً'}</option>
                            {rowLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                          </select>
                        </td>

                        {/* السورة المتوقف عندها من جميع سور القرآن */}
                        <td style={{ minWidth: 150 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.stopped_surah || ''}
                            onChange={e => handleInlineUpdate(a, 'stopped_surah', e.target.value)}
                          >
                            <option value="">-- السورة --</option>
                            {quranSurahs.map(s => <option key={s.id} value={s.name}>{s.id} - {s.name}</option>)}
                          </select>
                        </td>

                        {/* الأيام المناسبة للدارس */}
                        <td style={{ minWidth: 140 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.preferred_days || ''}
                            onChange={e => handleInlineUpdate(a, 'preferred_days', e.target.value)}
                          >
                            <option value="">-- اليومان --</option>
                            {PREFERRED_DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>

                        {/* التوقيت المناسب للدارس */}
                        <td style={{ minWidth: 150 }}>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={a.preferred_time || ''}
                            onChange={e => handleInlineUpdate(a, 'preferred_time', e.target.value)}
                          >
                            <option value="">-- التوقيت --</option>
                            {PREFERRED_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>

                        {/* المجموعة (1 - 40) */}
                        <td style={{ textAlign: 'center', minWidth: 120 }}>
                          {isAdminOrSupervisor ? (
                            <select
                              className="form-select"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              value={a.group_no || ''}
                              onChange={e => handleInlineUpdate(a, 'group_no', e.target.value)}
                            >
                              <option value="">غير مسكن</option>
                              {placementGroups.map(g => (
                                <option key={g.group_no} value={g.group_no}>
                                  مجموعة {g.group_no} ({g.group_no <= 20 ? '6-8 م' : '8-10 م'})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{a.group_no ? `مجموعة ${a.group_no}` : '-'}</span>
                          )}
                        </td>

                        {/* تاريخ وتوقيت الاختبار */}
                        <td style={{ textAlign: 'center', fontSize: 12, direction: 'ltr' }}>
                          <div>{a.exam_date || '-'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {a.exam_time ? formatTime12Ar(a.exam_time) : (grp?.shift_label || '')}
                          </div>
                        </td>

                        <td className="actions-cell" style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="رابط تيمز للمجموعة"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#10b981',
                                color: '#fff', padding: '4px 8px', borderRadius: 4, textDecoration: 'none', fontSize: 12
                              }}
                            >
                              <Video size={13} /> تيمز
                            </a>
                          )}
                          {isAdminOrSupervisor && (
                            <>
                              <Link
                                to={`/platform-applicants/create?id=${a.id}`}
                                className="action-icon edit"
                                style={{ textDecoration: 'none', color: 'inherit' }}
                                title="تعديل"
                              >
                                <Edit size={16} />
                              </Link>
                              <button className="action-icon delete" title="حذف" onClick={() => deletePlatformApplicant(a.id)}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                السابق
              </button>
              <span style={{ alignSelf: 'center', fontSize: 14 }}>صفحة {currentPage} من {totalPages}</span>
              <button className="btn btn-outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                التالي
              </button>
            </div>
          )}
        </>
      )}

      {/* ───────── التبويب الثاني: المجموعات الـ 40 (20 من 6-8 م | 20 من 8-10 م) ───────── */}
      {activeTab === 'groups' && (
        <div>
          {[
            { title: 'الفترة الأولى: 20 مجموعة (من 6 إلى 8 مساءً)', min: 1, max: 20, badgeColor: '#3b82f6' },
            { title: 'الفترة الثانية: 20 مجموعة (من 8 إلى 10 مساءً)', min: 21, max: 40, badgeColor: '#10b981' },
          ].map(shift => {
            const shiftGroups = placementGroups.filter(g => g.group_no >= shift.min && g.group_no <= shift.max);
            return (
              <div key={shift.title} className="box-card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} style={{ color: shift.badgeColor }} /> {shift.title}
                  </h3>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    سعة كل مجموعة: {PLACEMENT_GROUP_CAPACITY} دارساً يومياً (تسكين المحفظين والمنسقين والدارسين متاح في أي وقت)
                  </span>
                </div>

                <div className="table-wrapper">
                  <table className="management-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center' }}>رقم المجموعة</th>
                        <th style={{ textAlign: 'center' }}>الفترة الزمنية</th>
                        <th style={{ textAlign: 'center' }}>المحفظ (اسم الحلقة/المجموعة)</th>
                        <th style={{ textAlign: 'center' }}>المنسق المشرف</th>
                        <th style={{ textAlign: 'center' }}>رابط تيمز (Teams)</th>
                        <th style={{ textAlign: 'center' }}>المسكنون حالياً</th>
                        <th style={{ textAlign: 'center' }}>عرض</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftGroups.map(g => {
                        const count = platformApplicants.filter(a => Number(a.group_no) === Number(g.group_no)).length;
                        return (
                          <tr key={g.id}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              مجموعة {g.group_no}
                              {g.mohfez && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>حلقة الشيخ/ {g.mohfez}</div>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                background: `${shift.badgeColor}20`, color: shift.badgeColor,
                                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 'bold'
                              }}>
                                {g.shift_label}
                              </span>
                            </td>
                            <td style={{ minWidth: 200 }}>
                              {isAdminOrSupervisor ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: 13 }}
                                  value={g.mohfez || ''}
                                  onChange={e => handleGroupUpdate(g, 'mohfez', e.target.value)}
                                >
                                  <option value="">--- تسكين محفظ لاحقاً ---</option>
                                  {platformMohfezs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                              ) : (
                                <div style={{ textAlign: 'center' }}>{g.mohfez || 'غير مسكن بعد'}</div>
                              )}
                            </td>
                            <td style={{ minWidth: 200 }}>
                              {isAdminOrSupervisor ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: 13 }}
                                  value={g.coordinator || ''}
                                  onChange={e => handleGroupUpdate(g, 'coordinator', e.target.value)}
                                >
                                  <option value="">--- تسكين منسق لاحقاً ---</option>
                                  {platformCoordinators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                              ) : (
                                <div style={{ textAlign: 'center' }}>{g.coordinator || 'غير مسكن بعد'}</div>
                              )}
                            </td>
                            <td style={{ minWidth: 220 }}>
                              {isAdminOrSupervisor ? (
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '5px 8px', fontSize: 12 }}
                                  placeholder="رابط اجتماع Teams..."
                                  value={g.teams_link || ''}
                                  onChange={e => handleGroupUpdate(g, 'teams_link', e.target.value)}
                                  dir="ltr"
                                />
                              ) : g.teams_link ? (
                                <a href={g.teams_link} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>
                                  دخول الرابط
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {count} / {PLACEMENT_GROUP_CAPACITY}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                onClick={() => {
                                  setFilterGroupNo(String(g.group_no));
                                  setActiveTab('applicants');
                                }}
                              >
                                دارسو المجموعة
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────── التبويب الثالث: المجموعات المتوافقة لدمجها في الحلقات الأصلية ───────── */}
      {activeTab === 'compatible' && isAdminOrSupervisor && (
        <div className="box-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>المجموعات المتوافقة (حسب الرواق والمستوى والسورة والأيام والتوقيت)</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            يتم تجميع الدارسين الذين تم تحديد مستواهم وتتشابه اختياراتهم تلقائياً هنا لدمج كل مجموعة متوافقة مع بعضها في الحلقات الأصلية.
          </p>

          <div className="table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>م</th>
                  <th style={{ textAlign: 'center' }}>الرواق</th>
                  <th style={{ textAlign: 'center' }}>المستوى</th>
                  <th style={{ textAlign: 'center' }}>السورة المتوقف عندها</th>
                  <th style={{ textAlign: 'center' }}>الأيام المناسبة</th>
                  <th style={{ textAlign: 'center' }}>التوقيت المناسب</th>
                  <th style={{ textAlign: 'center' }}>عدد الدارسين المتوافقين</th>
                  <th style={{ textAlign: 'center' }}>تصدير</th>
                </tr>
              </thead>
              <tbody>
                {compatibleBuckets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      لا توجد مجموعات مصنفة بعد — ستظهر تلقائياً بمجرد رفع وتحديد مستويات الدارسين.
                    </td>
                  </tr>
                ) : (
                  compatibleBuckets.map((b, idx) => (
                    <tr key={b.key}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{b.rowaq}</td>
                      <td style={{ textAlign: 'center' }}>{b.level}</td>
                      <td style={{ textAlign: 'center' }}>{b.stopped_surah}</td>
                      <td style={{ textAlign: 'center' }}>{b.preferred_days}</td>
                      <td style={{ textAlign: 'center' }}>{b.preferred_time}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{b.members.length} دارس</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            const rows = b.members.map(m => ({
                              'الاسم': m.name,
                              'الرقم القومي أو جواز السفر': m.national_id || m.passport_no || '',
                              'الرواق': b.rowaq,
                              'المستوى': b.level,
                              'السورة المتوقف عندها': b.stopped_surah,
                              'الأيام المناسبة': b.preferred_days,
                              'التوقيت المناسب': b.preferred_time,
                            }));
                            exportToXLSX(rows, `مجموعة_متوافقة_${b.rowaq}_${b.level}`, 'مجموعة متوافقة');
                          }}
                        >
                          <Download size={14} /> تصدير المجموعة
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlatformApplicantsList;
