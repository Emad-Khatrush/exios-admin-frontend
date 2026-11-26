import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api';

// The count of new complaints/suggestions (unread by staff) and ratings not seen yet, beside
// «Reviews» in the menu (owner 2026-11-27). Read every minute, on every page change, and at once when
// the Reviews page marks something read (the 'reviews-changed' event).
export const REVIEWS_CHANGED = 'reviews-changed';
export const reviewsChanged = () => window.dispatchEvent(new Event(REVIEWS_CHANGED));

const ReviewsBadge = () => {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () => api.get('reviews/unread')
      .then((res: any) => { if (alive) setCount(Number(res?.data?.total) || 0); })
      .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener(REVIEWS_CHANGED, load);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener(REVIEWS_CHANGED, load); };
  }, [location.pathname]);

  if (!count) return null;
  return <span className="sidebar-badge" aria-label={`${count} new`}>{count > 99 ? '99+' : count}</span>;
};

export default ReviewsBadge;
