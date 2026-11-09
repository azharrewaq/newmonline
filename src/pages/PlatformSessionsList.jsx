import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Download, Upload, Edit, Trash2, ClipboardCheck, FileText, Video, Play, UserCheck, Loader2 } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import { exportToXLSX, importFromXLSX } from '../utils/xlsxHelper';
import { filterSessionsForUser, normalizeArabic } from '../utils/userScopeHelper';
import { countriesList } from '../data/countries';
import { getJoinState, useNow, formatReportText, toLocalDateStr } from '../utils/sessionHelpers';
import { getSubstitutionFor } from '../utils/userScopeHelper';
import { getApplicantExamJoinState, formatTime12Ar, normalizeExamDate, normalizeExamTime, formatExamDateAr, getGroupTimeLabel, createDefaultPlacementGroups } from '../utils/placementHelpers';
import { apiCall } from '../utils/apiService';
import SubstituteModal from '../components/SubstituteModal';

function PlatformSessionsList() {
  const { 
    platformSessions, 
    deletePlatformSession, 
    addPlatformSession, 
    rowaqs, 
    hasPermission, 
    deleteAllPlatformSessions,
    platformCoordinators = [],
    platformMohfezs = [],
    platformStudents = [],
    users = [],
    holidays = [],
    sessionReports = [],
    substitutions = [],
    platformApplicants = [],
    placementGroups = [],
    updatePlatformApplicant,
    recordSessionJoin
  } = useAppData();
  const importRef = useRef(null);
  const [substituteFor, setSubstituteFor] = useState(null);
  const [searchParams] = useSearchParams();
  const now = useNow(30000);
  const [expandedReports, setExpandedReports] = useState({});
  
  // Get current user and role
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = currentUser ? currentUser.role : 'admin';
  const isStudent = role === 'student' || role === 'sharia_student';
  // تعيين محفظ بديل: الإدارة والمشرفون ومنسق الحلقة (الحلقات المعروضة له مقصورة على حلقاته)
  const canAssignSubstitute = ['admin', 'platform_admin', 'platform_supervisor', 'platform_coordinator'].includes(role);

  const [filterCountry, setFilterCountry] = useState('');
  const [filterRowaq, setFilterRowaq] = useState('');
  const [filterStudentType, setFilterStudentType] = useState('');
  const [filterActiveNow, setFilterActiveNow] = useState(searchParams.get('active') === 'true');

  const toEnglishDigits = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .trim();
  };

  const matchByName = (nameA, nameB) => {
    const nA = normalizeArabic(nameA);
    const nB = normalizeArabic(nameB);
    if (!nA || !nB) return false;
    if (nA === nB) return true;
    if (nA.startsWith(nB) || nB.startsWith(nA)) return true;
    const wordsA = nA.split(/\s+/).filter(Boolean);
    const wordsB = nB.split(/\s+/).filter(Boolean);
    if (wordsA.length >= 2 && wordsB.length >= 2) {
      if (wordsA[0] === wordsB[0] && wordsA[1] === wordsB[1]) {
        if (wordsA.length >= 3 && wordsB.length >= 3) {
          return wordsA[2] === wordsB[2];
        }
        return true;
      }
    }
    return false;
  };

  const matchedUserInList = useMemo(() => {
    if (!currentUser) return null;
    return users.find(u => {
      const uNid = toEnglishDigits(String(u.national_id || u.username || '').trim());
      const curNid = toEnglishDigits(String(currentUser.national_id || currentUser.username || '').trim());
      if (curNid && uNid && curNid === uNid) return true;
      if (currentUser.name && u.name && matchByName(currentUser.name, u.name)) return true;
      return false;
    });
  }, [users, currentUser]);

  const effectiveNid = toEnglishDigits(
    String(currentUser?.national_id || matchedUserInList?.national_id || currentUser?.username || matchedUserInList?.username || '').trim()
  );
  const effectiveName = currentUser?.name || matchedUserInList?.name || '';

  const [remoteApplicant, setRemoteApplicant] = useState(currentUser?.applicantData || null);
  const [applicantLoading, setApplicantLoading] = useState(false);
  const defaultPlacementGroups = useMemo(() => createDefaultPlacementGroups(), []);

  const myApplicant = useMemo(() => {
    if (currentUser?.applicantData?.exam_date || currentUser?.applicantData?.group_no) {
      return currentUser.applicantData;
    }
    if (remoteApplicant?.exam_date || remoteApplicant?.group_no) return remoteApplicant;

    if (effectiveNid && platformApplicants?.length > 0) {
      const found = platformApplicants.find(a => {
        const aNid = toEnglishDigits(String(a.national_id || a.passport_no || '').trim());
        return aNid && aNid === effectiveNid;
      });
      if (found) return found;
    }
    if (effectiveName && platformApplicants?.length > 0) {
      const foundByName = platformApplicants.find(a => a.name && matchByName(a.name, effectiveName));
      if (foundByName) return foundByName;
    }
    return remoteApplicant || currentUser?.applicantData || null;
  }, [currentUser, matchedUserInList, effectiveNid, effectiveName, platformApplicants, remoteApplicant]);

  useEffect(() => {
    if (!isStudent) return;
    if (myApplicant?.exam_date || myApplicant?.group_no) return;

    let isMounted = true;
    const fetchApplicantData = async () => {
      setApplicantLoading(true);
      try {
        let res = null;
        if (effectiveNid) {
          res = await apiCall(`/platformapplicants/${encodeURIComponent(effectiveNid)}`).catch(() => null);
        }
        if (!res && effectiveName) {
          res = await apiCall(`/platformapplicants/${encodeURIComponent(effectiveName)}`).catch(() => null);
        }
        if (isMounted && res && (res.name || res.national_id || res.group_no)) {
          const normRes = {
            ...res,
            id: res.id || res._id,
            exam_date: res.exam_date ? normalizeExamDate(res.exam_date) : '',
            exam_time: res.exam_time ? normalizeExamTime(res.exam_time) : ''
          };
          setRemoteApplicant(normRes);
          try {
            const rawCur = sessionStorage.getItem('currentUser');
            if (rawCur) {
              const curObj = JSON.parse(rawCur);
              curObj.applicantData = normRes;
              if (normRes.national_id) curObj.national_id = normRes.national_id;
              if (normRes.name) curObj.name = normRes.name;
              sessionStorage.setItem('currentUser', JSON.stringify(curObj));
            }
          } catch {}
        }
      } catch (err) {
        console.error('Failed to fetch applicant data for student:', err);
      } finally {
        if (isMounted) setApplicantLoading(false);
      }
    };
    fetchApplicantData();
    return () => { isMounted = false; };
  }, [isStudent, effectiveNid, effectiveName, myApplicant]);

  // زر الدخول للحلقة: يُفعَّل قبل الموعد بربع ساعة ويتوقف مع انتهاء وقت الحلقة (الأدمن مستثنى)
  const renderJoinButton = (s) => {
    const joinState = getJoinState(s, holidays, now);
    const canJoin = role === 'admin' || joinState.open;
    const baseStyle = {
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px',
      textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', border: 'none', fontFamily: 'inherit',
      color: 'white', backgroundColor: canJoin ? '#10b981' : '#6b7280',
      cursor: canJoin ? 'pointer' : 'not-allowed', opacity: canJoin ? 1 : 0.7
    };
    const isEmbedded = s.stream_type === 'embedded';
    const Icon = isEmbedded ? Play : Video;
    if (!canJoin) {
      return (
        <button type="button" disabled title={joinState.reason} style={baseStyle}>
          <Icon size={14}/> الدخول للحلقة
        </button>
      );
    }
    if (isEmbedded) {
      // البث المدمج يُفتح في تبويب جديد (يتم تسجيل الحضور داخل صفحة البث)
      return (
        <button type="button" title="الدخول للحلقة" style={baseStyle}
          onClick={() => window.open(`/live/${s.id}`, '_blank')}>
          <Icon size={14}/> الدخول للحلقة
        </button>
      );
    }
    return (
      <a href={s.teams_link} target="_blank" rel="noopener noreferrer" title="الدخول للحلقة" style={baseStyle}
        onClick={() => recordSessionJoin(s, currentUser)}>
        <Icon size={14}/> الدخول للحلقة
      </a>
    );
  };

  const formatTimeTo12Hour = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hourFormatted = String(hours).padStart(2, '0');
    return `${hourFormatted}:${minutes} ${ampm}`;
  };

  // 1. فلترة الحلقات بدقة حسب صلاحية ونطاق المستخدم (منسق، محفظ، دارس)
  const scopedSessions = useMemo(() => {
    return filterSessionsForUser(platformSessions, currentUser, {
      platformCoordinators,
      platformMohfezs,
      platformStudents,
      users
    });
  }, [platformSessions, currentUser, platformCoordinators, platformMohfezs, platformStudents, users, substitutions]);

  // 2. تطبيق فلاتر واجهة المستخدم
  const filtered = scopedSessions.filter(s => {
    if (filterCountry && !(s.countries && s.countries.includes(filterCountry))) return false;
    if (filterRowaq && s.rowaq !== filterRowaq) return false;
    if (filterStudentType && s.student_type !== filterStudentType) return false;
    
    if (filterActiveNow) {
      const dayNamesMap = {
        0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت'
      };
      const currentDayName = dayNamesMap[new Date().getDay()];
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const isTodayWorkday = s.workDays && s.workDays.includes(currentDayName);
      if (!isTodayWorkday) return false;
      if (!s.time_start || !s.time_end) return false;
      
      const startMin = timeToMinutes(s.time_start);
      const endMin = timeToMinutes(s.time_end);
      if (currentMinutes < startMin || currentMinutes > endMin) return false;
    }
    
    return true;
  });

  const handleExport = () => {
    const exportData = filtered.map(s => ({
      'رقم الحلقة': s.session_no,
      'رابط الحلقة': s.teams_link || '',
      'المحفظ': s.mohfez || '',
      'المنسق': s.coordinator || '',
      'الدول': s.countries ? s.countries.join(', ') : '',
      'الرواق': s.rowaq,
      'المستوى': s.level,
      'الدارسين': s.student_type,
    }));
    exportToXLSX(exportData, 'الحلقات', 'حلقات المنصة');
  };

  const handleExportTemplate = () => {
    exportToXLSX([{
      'رقم الحلقة': '',
      'رابط الحلقة': '',
      'المحفظ': '',
      'المنسق': '',
      'الدول': '',
      'الرواق': '',
      'المستوى': '',
      'الدارسين': '',
    }], 'نموذج_استيراد_الحلقات', 'نموذج');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromXLSX(file);
      rows.forEach(row => {
        addPlatformSession({
          session_no: row['رقم الحلقة'] || Date.now().toString().slice(-8),
          teams_link: row['رابط الحلقة'] || '',
          mohfez: row['المحفظ'] || '',
          coordinator: row['المنسق'] || '',
          countries: row['الدول'] ? row['الدول'].split(', ') : [],
          rowaq: row['الرواق'] || '',
          level: row['المستوى'] || '',
          student_type: row['الدارسين'] || '',
        });
      });
      alert('تم استيراد البيانات بنجاح');
    } catch {
      alert('حدث خطأ في استيراد الملف');
    }
    e.target.value = '';
  };

  // عرض الدارس: صفحة موعد وبيانات اختبار تحديد المستوى
  if (isStudent && hasPermission('sessions', 'view')) {
    const activeApp = myApplicant || {
      name: effectiveName || currentUser?.name || 'الدارس',
      national_id: effectiveNid || currentUser?.username || '-',
      passport_no: effectiveNid || currentUser?.username || '-',
      rowaq: currentUser?.rowaq || 'رواق القرآن الكريم',
      level: currentUser?.level || 'المستوى الأول',
      group_no: currentUser?.group_no || '',
      exam_date: currentUser?.exam_date || '',
      exam_time: currentUser?.exam_time || '',
      teams_link: currentUser?.teams_link || '',
      scientific_supervisor: currentUser?.scientific_supervisor || '',
      technical_supervisor: currentUser?.technical_supervisor || '',
      mohfez: currentUser?.mohfez || '',
      coordinator: currentUser?.coordinator || '',
      status: currentUser?.status || 'في انتظار الاختبار',
    };
    const myPlacementGroup = activeApp.group_no
      ? (placementGroups.find(g => Number(g.group_no) === Number(activeApp.group_no)) ||
         defaultPlacementGroups.find(g => Number(g.group_no) === Number(activeApp.group_no)) ||
         null)
      : null;
    const examJoin = getApplicantExamJoinState(activeApp, myPlacementGroup, now);
    const examLink = activeApp?.teams_link || myPlacementGroup?.teams_link || '';
    const examMohfez = activeApp?.mohfez || myPlacementGroup?.mohfez || '-';
    const examCoord = activeApp?.coordinator || myPlacementGroup?.coordinator || '-';
    const examSciSupervisor = activeApp?.scientific_supervisor || myPlacementGroup?.scientific_supervisor || '-';
    const examTechSupervisor = activeApp?.technical_supervisor || myPlacementGroup?.technical_supervisor || '-';
    const groupTimeLabel = getGroupTimeLabel(myPlacementGroup, [activeApp]);
    const examShift = groupTimeLabel || (activeApp?.exam_time ? formatTime12Ar(activeApp.exam_time) : 'سيتم تحديده قريباً');

    const reportBoxStyle = {
      whiteSpace: 'pre-wrap', lineHeight: 2, background: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '14px 16px', margin: 0,
      fontFamily: 'inherit', fontSize: 15, direction: 'rtl', textAlign: 'right'
    };
    return (
      <div className="management-page">
        <div className="page-header">
          <div className="title-section">
            <h2>{scopedSessions.length > 0 ? 'تقرير الحلقة' : 'موعد اختبار تحديد المستوى'}</h2>
            <p>{scopedSessions.length > 0 ? 'آخر تقرير سجّله المحفظ لحلقتك' : 'بيانات لجنة وموعد اختبار تحديد المستوى ورابط الدخول الخاص بك'}</p>
          </div>
        </div>

        {scopedSessions.length === 0 && (
          <div className="box-card" style={{ padding: 28, marginBottom: 24, border: '2px solid var(--accent-gold)', backgroundColor: 'var(--bg-card)' }}>
            {/* ترويسة إخطار موعد اختبار تحديد المستوى */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              paddingBottom: 18,
              marginBottom: 20,
              borderBottom: '2px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: 15, color: 'var(--accent-gold)', fontWeight: '800', marginBottom: 6 }}>
                  الجامع الأزهر الشريف — الإدارة العامة للجامع الأزهر (إدارة شئون الأروقة)
                </div>
                <h3 style={{ fontSize: 22, fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  إخطار بموعد وبيانات لجنة اختبار تحديد المستوى
                </h3>
              </div>
              <span style={{
                backgroundColor: activeApp.status === 'تم تحديد المستوى' ? '#10b981' : 'var(--accent-gold)',
                color: activeApp.status === 'تم تحديد المستوى' ? '#ffffff' : '#000000',
                padding: '8px 20px',
                borderRadius: 20,
                fontSize: 15,
                fontWeight: '800'
              }}>
                الحالة: {activeApp.status || 'في انتظار الاختبار'}
              </span>
            </div>

            {/* جدول بيانات الدارس ولجنة وموعد الاختبار */}
            <div className="table-wrapper" style={{ marginBottom: 22, border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th colSpan="4" style={{
                      textAlign: 'center',
                      background: 'linear-gradient(180deg, var(--accent-gold) 0%, var(--accent-gold-dark) 100%)',
                      color: '#000000',
                      fontSize: 18,
                      fontWeight: '800',
                      padding: '14px 18px',
                      borderBottom: '2px solid var(--border-subtle)'
                    }}>
                      بطاقة بيانات الدارس وموعد لجنة الاختبار
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ width: '20%', textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      اسم الدارس
                    </td>
                    <td style={{ width: '30%', textAlign: 'right', fontWeight: '800', fontSize: 18, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {activeApp.name || '-'}
                    </td>
                    <td style={{ width: '20%', textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      الرقم القومي / جواز السفر
                    </td>
                    <td style={{ width: '30%', fontWeight: '800', fontSize: 17, direction: 'ltr', textAlign: 'right', color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {activeApp.national_id || activeApp.passport_no || '-'}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      الرواق المتقدم إليه
                    </td>
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {activeApp.rowaq || '-'}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      تاريخ يوم الاختبار
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{
                        display: 'inline-block',
                        direction: 'ltr',
                        backgroundColor: 'var(--accent-gold)',
                        color: '#000000',
                        padding: '6px 16px',
                        borderRadius: 6,
                        fontSize: 17,
                        fontWeight: '800'
                      }}>
                        {formatExamDateAr(activeApp.exam_date) || 'سيتم تحديده قريباً'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      توقيت الاختبار والفترة
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        padding: '6px 16px',
                        borderRadius: 6,
                        fontSize: 16,
                        fontWeight: '800'
                      }}>
                        {activeApp.exam_time ? `الساعة ${formatTime12Ar(activeApp.exam_time)}` : examShift}
                      </span>
                      {groupTimeLabel && activeApp.exam_time && groupTimeLabel !== formatTime12Ar(activeApp.exam_time) && (
                        <span style={{ fontSize: 15, fontWeight: '700', color: 'var(--text-primary)', marginRight: 10 }}>
                          (فترة المجموعة: {groupTimeLabel})
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      رقم مجموعة الاختبار
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 18, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {activeApp.group_no ? `مجموعة رقم (${activeApp.group_no})` : 'جاري التسكين'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      المحفظ الممتحن
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {examMohfez && examMohfez !== '-' ? `الشيخ / ${examMohfez}` : 'سيتم تحديده قريباً'}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      المشرف العلمي
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {examSciSupervisor && examSciSupervisor !== '-' ? examSciSupervisor : 'سيتم تحديده قريباً'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      المشرف التقني
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {examTechSupervisor && examTechSupervisor !== '-' ? examTechSupervisor : 'سيتم تحديده قريباً'}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      المنسق المشرف
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {examCoord && examCoord !== '-' ? examCoord : 'سيتم تحديده قريباً'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                      نتيجة تحديد المستوى
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: activeApp.tested_level ? '#10b981' : 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      {activeApp.tested_level
                        ? `${activeApp.tested_level}${activeApp.stopped_surah ? ` (متوقف عند سورة: ${activeApp.stopped_surah})` : ''}`
                        : 'تُعلَن بعد أداء الاختبار'}
                    </td>
                  </tr>

                  {(activeApp.preferred_days || activeApp.preferred_time) && (
                    <tr>
                      <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                        الأيام المناسبة للدراسة
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        {activeApp.preferred_days || '-'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '15px 18px', background: 'rgba(212, 175, 55, 0.22)', color: 'var(--text-primary)', fontSize: 16, fontWeight: '800', border: '1px solid var(--border-subtle)' }}>
                        التوقيت المناسب للدراسة
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: 17, color: 'var(--text-primary)', padding: '15px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        {activeApp.preferred_time || '-'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* منطقة رابط الدخول للجنة الاختبار أو تنبيه موعد التفعيل */}
            <div style={{
              background: examJoin?.visible && examLink
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(212, 175, 55, 0.12)',
              border: `2px solid ${examJoin?.visible && examLink ? '#10b981' : 'var(--accent-gold)'}`,
              borderRadius: 10,
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: '800', color: 'var(--text-primary)', marginBottom: 6 }}>
                  رابط الدخول إلى لجنة الاختبار (Microsoft Teams)
                </div>
                <div style={{ fontSize: 16, fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                  {examJoin?.visible && examLink
                    ? 'اللجنة متاحة الآن — اضغط على الزر المقابل للدخول مباشرة إلى غرفة الاختبار.'
                    : (examJoin?.reason || 'يظهر رابط الدخول للجنة تلقائياً في يوم الاختبار قبل الموعد بـ 15 دقيقة ويستمر لمدة 30 دقيقة بعد الموعد.')}
                </div>
              </div>

              {examJoin?.visible && examLink ? (
                <a
                  href={examLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (activeApp.id) {
                      updatePlatformApplicant(activeApp.id, { exam_attended: true, exam_joined_at: new Date().toISOString() });
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    padding: '12px 26px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontWeight: '800',
                    fontSize: 16,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  <Video size={18} /> الدخول لاختبار تحديد المستوى الآن
                </a>
              ) : (
                <div style={{
                  backgroundColor: 'var(--accent-gold)',
                  color: '#000000',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: 15,
                  fontWeight: '800'
                }}>
                  يُفعَّل الرابط يوم {formatExamDateAr(activeApp.exam_date) || 'الاختبار'} قبل الموعد بـ 15 دقيقة
                </div>
              )}
            </div>
          </div>
        )}

        {scopedSessions.map(s => {
          const reports = sessionReports
            .filter(r => String(r.sessionId) === String(s.id) && !!r.isPlatform)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (parseInt(b.sessionNum, 10) || 0) - (parseInt(a.sessionNum, 10) || 0));
          const latest = reports[0];
          const older = reports.slice(1);
          const showOlder = !!expandedReports[s.id];
          return (
            <div key={s.id} className="box-card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 15 }}>
                <div>
                  <h3 style={{ fontSize: 17, marginBottom: 4 }}>حلقة {s.session_no}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    المحفظ: {s.mohfez || '-'} • {(s.workDays || []).join('، ')} • {formatTimeTo12Hour(s.time_start)} - {formatTimeTo12Hour(s.time_end)}
                  </div>
                </div>
                {(s.stream_type === 'embedded' || s.teams_link) && renderJoinButton(s)}
              </div>
              {latest ? (
                <>
                  <pre style={reportBoxStyle}>{formatReportText(latest, s)}</pre>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(formatReportText(latest, s))}>نسخ التقرير</button>
                    {older.length > 0 && (
                      <button className="btn btn-outline" onClick={() => setExpandedReports(p => ({ ...p, [s.id]: !p[s.id] }))}>
                        {showOlder ? 'إخفاء التقارير السابقة' : `التقارير السابقة (${older.length})`}
                      </button>
                    )}
                  </div>
                  {showOlder && older.map(r => (
                    <pre key={r.id} style={{ ...reportBoxStyle, marginTop: 10 }}>{formatReportText(r, s)}</pre>
                  ))}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>لم يتم تسجيل تقرير لهذه الحلقة بعد.</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (!hasPermission('sessions', 'view')) {
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
          <h2>حلقات المنصة</h2>
          <p>إدارة وعرض حلقات المنصة</p>
        </div>
      </div>

      {/* Search Filters */}
      <div className="search-section box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '15px' }}>
          <div className="form-group">
            <label>الدولة</label>
            <select className="form-select" value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
              <option value="">--- اختار الدولة ---</option>
              {countriesList.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>
          
          
          <div className="form-group">
            <label>الرواق</label>
            <select className="form-select" value={filterRowaq} onChange={e => setFilterRowaq(e.target.value)}>
              <option value="">--- اختار الرواق ---</option>
              <option value="رواق القرآن الكريم ( أطفال )">رواق القرآن الكريم ( أطفال )</option>
              <option value="رواق القرآن الكريم ( كبار )">رواق القرآن الكريم ( كبار )</option>
              <option value="رواق التجويد">رواق التجويد</option>
              <option value="رواق القراءات">رواق القراءات</option>
            </select>
          </div>
          <div className="form-group">
            <label>نوع الدارسين</label>
            <select className="form-select" value={filterStudentType} onChange={e => setFilterStudentType(e.target.value)}>
              <option value="">--- اختار النوع ---</option>
              <option value="رجال">رجال</option>
              <option value="نساء">نساء</option>
              <option value="أطفال">أطفال</option>
            </select>
          </div>
        </div>
        <div className="search-actions" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={() => { 
              setFilterCountry(''); setFilterRowaq(''); 
              setFilterStudentType(''); 
              setFilterActiveNow(false);
            }}>إعادة تعيين</button>
            <button className="btn btn-primary" style={{ marginRight: '10px' }}><Search size={16} /> بحث</button>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', margin: 0, fontWeight: 'bold', color: '#10b981' }}>
            <input 
              type="checkbox" 
              checked={filterActiveNow} 
              onChange={e => setFilterActiveNow(e.target.checked)} 
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            عرض الحلقات الجارية حالياً فقط
          </label>
        </div>
      </div>

      {/* Table controls */}
      <div className="table-controls" style={{ justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
        <div className="action-buttons" style={{ flexDirection: 'row-reverse' }}>
          {hasPermission('sessions', 'add') && (
            <>
              <Link to="/platform-sessions/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Plus size={16} /> إضافة حلقة
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
          {hasPermission('sessions', 'delete') && platformSessions.length > 0 && (
            <button className="btn btn-danger" onClick={deleteAllPlatformSessions}>
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
              <th style={{ textAlign: 'center' }}>رقم الحلقة</th>
              <th style={{ textAlign: 'center' }}>المحفظ</th>
              <th style={{ textAlign: 'center' }}>المنسق</th>
              <th style={{ textAlign: 'center' }}>الدولة</th>
              <th style={{ textAlign: 'center' }}>الرواق</th>
              <th style={{ textAlign: 'center' }}>المستوى</th>
              <th style={{ textAlign: 'center' }}>الدارسين</th>
              <th style={{ textAlign: 'center' }}>الوقت من</th>
              <th style={{ textAlign: 'center' }}>الوقت إلى</th>
              <th style={{ textAlign: 'center' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  لا توجد بيانات.
                </td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{s.session_no}</td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const sub = getSubstitutionFor(s.id, toLocalDateStr(now), substitutions);
                      return sub ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{s.mohfez}</span>
                          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 12 }}>بديل اليوم: {sub.substituteName}</div>
                        </>
                      ) : s.mohfez;
                    })()}
                  </td>
                  <td style={{ textAlign: 'center', color: s.coordinator ? 'inherit' : 'var(--text-muted)' }}>{s.coordinator || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{s.countries ? s.countries.join('، ') : ''}</td>
                  <td style={{ textAlign: 'center' }}>{s.rowaq}</td>
                  <td style={{ textAlign: 'center' }}>{s.level}</td>
                  <td style={{ textAlign: 'center' }}>{s.student_type}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center' }}>{formatTimeTo12Hour(s.time_start) || '-'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center' }}>{formatTimeTo12Hour(s.time_end) || '-'}</td>
                  <td className="actions-cell" style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link to={`/platform-sessions/${s.id}/attendance`} title="الغياب" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', textDecoration: 'none' }}>
                      <ClipboardCheck size={14}/> الغياب
                    </Link>
                    {!isStudent && (
                      <Link to={`/platform-sessions/${s.id}/reports`} title="التقارير اليومية" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', textDecoration: 'none' }}>
                        <FileText size={14}/> التقارير
                      </Link>
                    )}
                    {canAssignSubstitute && (
                      <button title="محفظ بديل" onClick={() => setSubstituteFor(s)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                        <UserCheck size={14}/> بديل
                      </button>
                    )}
                    {hasPermission('sessions', 'edit') && (
                      <Link to={`/platform-sessions/create?id=${s.id}`} className="action-icon edit" style={{textDecoration: 'none', color: 'inherit'}} title="تعديل"><Edit size={16}/></Link>
                    )}
                    {hasPermission('sessions', 'delete') && (
                      <button className="action-icon delete" title="حذف" onClick={() => deletePlatformSession(s.id)}><Trash2 size={16}/></button>
                    )}
                    {s.stream_type === 'embedded' || s.teams_link ? renderJoinButton(s) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {substituteFor && <SubstituteModal session={substituteFor} onClose={() => setSubstituteFor(null)} />}
    </div>
  );
}

export default PlatformSessionsList;


