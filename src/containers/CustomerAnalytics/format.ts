import moment from 'moment';

// How the customer analytics page writes money, rates, months and dates. The API sends money in US
// cents, rates as 0..1 (or null when there is nothing to divide by) and months as 'YYYY-MM'.

export const usd = (cents?: number | null) => (cents == null ? '—'
  : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
// Big totals: whole dollars, grouped
export const usdWhole = (cents?: number | null) => (cents == null ? '—'
  : `$${Math.round(cents / 100).toLocaleString('en-US')}`);
export const count = (n?: number | null) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
export const decimal = (n?: number | null, digits = 1) => (n == null ? '—'
  : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits }));
// 0.4567 → «45.7%», 1 → «100%», null → «—»
export const pct = (rate?: number | null) => (rate == null ? '—'
  : `${(Math.round(rate * 1000) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);
export const days = (n?: number | null) => (n == null ? '—' : `${decimal(n, 0)} يوم`);

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
// '2026-11' → «نوفمبر 2026»
export const monthName = (key: string) => {
  const [year, month] = String(key).split('-').map(Number);
  const name = MONTHS[(month || 0) - 1];
  return name ? `${name} ${year}` : key;
};
// '2026-11' → «نوفمبر 26» for chart axes
export const monthShort = (key: string) => {
  const [year, month] = String(key).split('-').map(Number);
  const name = MONTHS[(month || 0) - 1];
  return name ? `${name} ${String(year).slice(2)}` : key;
};

export const date = (value?: string | null) => (value ? moment(value).format('DD/MM/YYYY') : '—');
export const time = (value?: string | null) => (value ? moment(value).format('DD/MM/YYYY HH:mm') : '—');
// 'YYYY-MM-DD' → 'DD/MM/YYYY'
export const day = (value?: string | null) => (value ? moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY') : '—');

export const OFFICE_TEXT: Record<string, string> = { tripoli: 'طرابلس', benghazi: 'بنغازي' };
export const officeName = (office?: string | null) => (office ? OFFICE_TEXT[office] || office : 'غير محدد');
// Customers' cities are saved as the client app's keys (Exios-Client/src/constants/info.ts)
const CITY_TEXT: Record<string, string> = {
  tripoli: 'طرابلس', benghazi: 'بنغازي', misrata: 'مصراتة', zawiya: 'الزاوية', bayda: 'البيضاء', tobruk: 'طبرق', ajdabiya: 'اجدابيا',
  zliten: 'زليتن', derna: 'درنة', sabha: 'سبها', sabratha: 'صبراتة', kufra: 'الكفرة', marj: 'المرج', sirte: 'سرت', other: 'مدينة أخرى',
};
export const cityName = (city?: string | null) => (city && city.trim() ? CITY_TEXT[city.trim().toLowerCase()] || city : 'غير محدد');

// The rows of a table as a CSV file the browser saves; UTF-8 with a BOM so Excel shows the Arabic
export const downloadCsv = (name: string, header: string[], rows: (string | number | null | undefined)[][]) => {
  const cell = (v: string | number | null | undefined) => {
    const text = v == null ? '' : String(v);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
