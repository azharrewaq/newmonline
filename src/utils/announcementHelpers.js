import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';

/** هل المستخدم من إدارة المنصة (إعلانات / إجازات / رقم بدء الجلسة)؟ */
export const isPlatformManager = (user) => ['admin', 'platform_admin'].includes(user?.role);

export const getUserKey = (user) => String(user?.national_id || user?.username || user?.email || user?.id || 'anon').trim();

/** هل الإعلان موجَّه للمستخدم؟ */
export const isAnnouncementForUser = (ann, user) => {
  if (!user) return false;
  if (isPlatformManager(user)) return true;
  if (ann.audience === 'student') return user.role === 'student';
  return true; // all
};

const seenKey = (user) => `ann_seen_${getUserKey(user)}`;
const readSeen = (user) => {
  try { return JSON.parse(localStorage.getItem(seenKey(user)) || '[]'); } catch { return []; }
};

/**
 * إشعارات الإعلانات:
 * - الدارس/الكادر: إعلانات جديدة لم تُقرأ
 * - الأدمن: ردود جديدة لم تُقرأ
 */
export function useAnnouncementNotifications() {
  const { announcements = [], announcementReplies = [] } = useAppData();
  const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || 'null'), []);
  const [seenVersion, setSeenVersion] = useState(0);
  const manager = isPlatformManager(currentUser);

  const unreadAnnouncements = useMemo(() => {
    if (!currentUser || manager) return [];
    const seen = new Set(readSeen(currentUser).map(String));
    return announcements.filter(a => isAnnouncementForUser(a, currentUser) && !seen.has(String(a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements, currentUser, manager, seenVersion]);

  const unreadReplies = useMemo(
    () => (manager ? announcementReplies.filter(r => !r.readByAdmin) : []),
    [announcementReplies, manager]
  );

  const markAnnouncementsSeen = useCallback((ids) => {
    if (!currentUser || !ids.length) return;
    const merged = Array.from(new Set([...readSeen(currentUser).map(String), ...ids.map(String)]));
    localStorage.setItem(seenKey(currentUser), JSON.stringify(merged));
    window.dispatchEvent(new Event('ann-seen'));
  }, [currentUser]);

  useEffect(() => {
    const onSeen = () => setSeenVersion(v => v + 1);
    window.addEventListener('ann-seen', onSeen);
    return () => window.removeEventListener('ann-seen', onSeen);
  }, []);

  return {
    manager,
    unreadAnnouncements,
    unreadReplies,
    count: manager ? unreadReplies.length : unreadAnnouncements.length,
    markAnnouncementsSeen,
  };
}
