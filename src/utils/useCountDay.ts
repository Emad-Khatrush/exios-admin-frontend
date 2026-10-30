import { useEffect, useState } from 'react';
import { sys } from '../containers/Accounting/accountingApi';

// When the boxes were counted at go-live (null before the migration is committed). Money dated
// before the count is already in the counted amount: accounting records it against the opening
// balance instead of the box, and the screens say so before saving. What is done on the count day
// after the count moves the box as usual.
export type Count = { day: string; at: string; endOfDay: boolean };

let loading: Promise<Count | null> | null = null;
const loadCount = () => {
  if (!loading) {
    loading = sys.get('acc/count-day')
      .then((res: any) => (res.data?.day ? { day: res.data.day, at: res.data.at, endOfDay: !!res.data.endOfDay } : null))
      .catch(() => {
        loading = null;
        return null;
      });
  }
  return loading as Promise<Count | null>;
};

export const useCountDay = () => {
  const [count, setCount] = useState<Count | null>(null);
  useEffect(() => {
    let alive = true;
    loadCount().then((value) => { if (alive) setCount(value); });
    return () => { alive = false; };
  }, []);
  return count;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Whether money dated `value` is in the count: a plain day before the count day (or on it when
// the count is its end), or a moment up to the count. Same rule as the server (ledger.js)
export const isBeforeCount = (count: Count | null, value: any) => {
  if (!count || !value) return false;
  if (typeof value === 'string' && DAY.test(value)) return value < count.day || (value === count.day && count.endOfDay);
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return false;
  return date.getTime() <= new Date(count.at).getTime();
};

export const beforeCountText = (count: Count) =>
  `التاريخ قبل الجرد (${count.day}): الجرد احتسب هذا المال، فلن يُضاف للخزينة أو يُخصم منها مرة ثانية، ويُسجَّل على الأرصدة الافتتاحية. المصروف أو الإيراد يبقى في شهره.`;
