import { Alert, Snackbar } from '@mui/material';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { CalendarDays, Check, Copy, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { User } from '../../../models';
import { copyText } from '../../../utils/copyText';
import './UserWidget.scss';

type Props = { client: User; index?: number; onEdit?: () => void };
const CITIES: Record<string, string> = { tripoli: 'طرابلس', benghazi: 'بنغازي', misrata: 'مصراتة', misurata: 'مصراتة', other: 'غير محددة' };

export default function UserWidget({ client, onEdit }: Props) {
  const isAdmin = useSelector((state: any) => !!state.session.account.roles?.isAdmin);
  const [notice, setNotice] = useState<'copied' | 'error' | null>(null);
  const name = [client.firstName, client.lastName].filter(Boolean).join(' ').trim() || 'عميل بدون اسم';
  const initials = name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
  const created = new Date(client.createdAt);
  const city = CITIES[client.city?.trim().toLowerCase()] || client.city || 'غير محددة';
  const copyCode = async () => { try { await copyText(client.customerId); setNotice('copied'); } catch { setNotice('error'); } };
  return <section className="customer-profile-card" dir="rtl" aria-label="بيانات العميل">
    <header className="cpc-heading"><span className="cpc-avatar" aria-hidden="true">{initials}</span><div className="cpc-identity"><h2><bdi dir="auto">{name}</bdi></h2><span>بيانات العميل</span></div>{onEdit && isAdmin && <button className="cpc-edit" type="button" onClick={onEdit}><Pencil size={14} aria-hidden="true" />تعديل البيانات</button>}</header>
    <div className="cpc-content"><div className="cpc-code"><span>كود العميل</span><button type="button" onClick={copyCode} disabled={!client.customerId} aria-label={`نسخ كود العميل ${client.customerId || ''}`}><bdi dir="ltr">{client.customerId || '—'}</bdi>{notice === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button></div>
      <dl className="cpc-facts"><div><dt><Mail size={14} aria-hidden="true" />اسم المستخدم</dt><dd><bdi dir="auto">{client.username || 'غير مسجل'}</bdi></dd></div>{isAdmin && <div><dt><Phone size={14} aria-hidden="true" />رقم الهاتف</dt><dd><bdi dir="ltr">{client.phone || 'غير مسجل'}</bdi></dd></div>}<div><dt><MapPin size={14} aria-hidden="true" />المدينة</dt><dd>{city}</dd></div><div><dt><CalendarDays size={14} aria-hidden="true" />تاريخ التسجيل</dt><dd><bdi dir="ltr">{Number.isFinite(created.getTime()) ? created.toLocaleDateString('en-GB') : '—'}</bdi></dd></div></dl>
    </div>
    <Snackbar open={!!notice} autoHideDuration={3500} onClose={() => setNotice(null)}><Alert severity={notice === 'error' ? 'error' : 'success'} onClose={() => setNotice(null)}>{notice === 'error' ? 'تعذر النسخ، يمكنك تحديد الكود ونسخه يدويًا.' : 'تم نسخ كود العميل'}</Alert></Snackbar>
  </section>;
}
