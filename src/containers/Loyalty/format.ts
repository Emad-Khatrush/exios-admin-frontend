import moment from 'moment';

// How the loyalty screens write points, dollars and dates (100 points = $1)

export const pointsText = (value: number) => Number(value || 0).toLocaleString('en-US');
export const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// The server's dollar figure when it sends one, else worked out from the points
export const usdOf = (row: any) => Number(row?.usd ?? Number(row?.points || 0) / 100);

export const fullDate = (value?: string | Date) => (value ? moment(value).format('DD/MM/YYYY') : '—');
export const shortDate = (value?: string | Date) => (value ? moment(value).format('DD/MM') : '—');

// Calendar days between the date and today (0 = today)
const daysAgo = (value: string | Date) => moment().startOf('day').diff(moment(value).startOf('day'), 'days');

// "today", "yesterday", "3 days ago", then the date
export const relativeDay = (value?: string) => {
  if (!value) return '—';
  const days = daysAgo(value);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return fullDate(value);
};

// The heading of a day in a history list
export const dayHeading = (value: string) => {
  const days = daysAgo(value);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return fullDate(value);
};

// Up to two letters of a name, for the small avatar
export const initials = (name?: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
};
