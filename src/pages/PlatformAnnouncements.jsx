import React, { useMemo, useState } from 'react';
import { Megaphone, Send, Trash2, MessageCircle } from 'lucide-react';
import '../components/Management.css';
import { useAppData } from '../context/AppDataContext';
import {
  isPlatformManager, isAnnouncementForUser, getUserKey, useAnnouncementNotifications
} from '../utils/announcementHelpers';

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
};

function PlatformAnnouncements() {
  const {
    announcements = [], announcementReplies = [],
    addAnnouncement, deleteAnnouncement, addAnnouncementReply, markAnnouncementRepliesRead
  } = useAppData();
  const { markAnnouncementsSeen } = useAnnouncementNotifications();

  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const manager = isPlatformManager(currentUser);
  const myKey = getUserKey(currentUser);

  const [form, setForm] = useState({ title: '', body: '', audience: 'student' });
  const [replyText, setReplyText] = useState({});
  const [expanded, setExpanded] = useState({});

  const visible = useMemo(
    () => announcements
      .filter(a => isAnnouncementForUser(a, currentUser))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [announcements, currentUser]
  );

  // عند فتح الصفحة يُعتبر المستخدم (غير الأدمن) قد اطلع على الإعلانات
  React.useEffect(() => {
    if (!manager && visible.length) markAnnouncementsSeen(visible.map(a => a.id));
  }, [manager, visible, markAnnouncementsSeen]);

  const repliesOf = (annId) => announcementReplies
    .filter(r => String(r.announcementId) === String(annId))
    .filter(r => manager || String(r.authorKey) === myKey)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

  const handlePublish = () => {
    if (!form.title.trim() || !form.body.trim()) { alert('يرجى كتابة عنوان ونص الإعلان'); return; }
    addAnnouncement({ ...form, title: form.title.trim(), body: form.body.trim(), createdBy: currentUser?.name || 'الإدارة' });
    setForm({ title: '', body: '', audience: form.audience });
  };

  const handleReply = (annId) => {
    const text = (replyText[annId] || '').trim();
    if (!text) return;
    addAnnouncementReply({
      announcementId: String(annId),
      body: text,
      authorName: currentUser?.name || currentUser?.username || '',
      authorKey: myKey,
      authorRole: currentUser?.role || ''
    });
    setReplyText(prev => ({ ...prev, [annId]: '' }));
  };

  const toggleExpand = (annId) => {
    const open = !expanded[annId];
    setExpanded(prev => ({ ...prev, [annId]: open }));
    if (open && manager) {
      markAnnouncementRepliesRead(repliesOf(annId).filter(r => !r.readByAdmin).map(r => r.id));
    }
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="title-section">
          <h2><Megaphone size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />التعليمات والإعلانات</h2>
          <p>{manager ? 'انشر تعليمات وإعلانات وتابع ردود الدارسين عليها' : 'آخر التعليمات والإعلانات من إدارة المنصة'}</p>
        </div>
      </div>

      {manager && (
        <div className="box-card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ marginBottom: 15, fontSize: 16 }}>إعلان جديد</h3>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>العنوان</label>
            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>النص</label>
            <textarea className="form-input" rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 15, maxWidth: 300 }}>
            <label>موجّه إلى</label>
            <select className="form-select" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
              <option value="student">الدارسين</option>
              <option value="all">الجميع (دارسين ومحفظين ومنسقين)</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handlePublish}><Send size={16} /> نشر الإعلان</button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="box-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>لا توجد إعلانات.</div>
      ) : visible.map(a => {
        const replies = repliesOf(a.id);
        const newReplies = manager ? replies.filter(r => !r.readByAdmin).length : 0;
        return (
          <div key={a.id} className="box-card" style={{ marginBottom: 15, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 17, marginBottom: 4 }}>{a.title}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {fmt(a.createdAt)}{a.createdBy ? ` • ${a.createdBy}` : ''}
                  {manager && ` • موجّه إلى: ${a.audience === 'all' ? 'الجميع' : 'الدارسين'}`}
                </div>
              </div>
              {manager && (
                <button className="action-icon delete" title="حذف" onClick={() => deleteAnnouncement(a.id)}><Trash2 size={16} /></button>
              )}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, margin: '12px 0' }}>{a.body}</p>

            <button className="btn btn-outline" onClick={() => toggleExpand(a.id)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <MessageCircle size={15} /> {manager ? 'الردود' : 'الرد'} ({replies.length})
              {newReplies > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 7px', fontSize: 11 }}>{newReplies} جديد</span>
              )}
            </button>

            {expanded[a.id] && (
              <div style={{ marginTop: 12 }}>
                {replies.map(r => (
                  <div key={r.id} style={{
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                    borderRight: `3px solid ${manager && !r.readByAdmin ? '#ef4444' : 'var(--accent-gold, #d6af37)'}`
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {manager ? r.authorName : 'ردّك'} • {fmt(r.createdAt)}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div>
                  </div>
                ))}
                {!manager && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea
                      className="form-input" rows={2} style={{ flex: 1 }} placeholder="اكتب ردك هنا..."
                      value={replyText[a.id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [a.id]: e.target.value }))}
                    />
                    <button className="btn btn-primary" onClick={() => handleReply(a.id)}><Send size={16} /> إرسال</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PlatformAnnouncements;
