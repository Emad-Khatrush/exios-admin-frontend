import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import api from '../../api';

type Match = {
  trackingNumber: string
  orderObjectId: string
  orderId: string
  unsureOrder: boolean
  isCanceled: boolean
  isFinished: boolean
  received: boolean
  customer: { customerId?: string, name?: string } | null
};

type Props = {
  number: string
  // The order being edited (left out of the search) and its customer
  orderId?: string
  customerId?: string
};

const normalize = (value: string) => String(value || '').replace(/\s+/g, '').toLowerCase();

// Where else the tracking number being typed already is: a customer's waiting package (طرود منتظرة)
// or another order. A warning only; saving is never stopped. Each one opens in a new tab.
const TrackingMatches = ({ number, orderId, customerId }: Props) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const wanted = normalize(number);

  useEffect(() => {
    if (wanted.length < 4) { setMatches([]); return; }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('orders/trackingMatches', { numbers: wanted, ...(orderId && { exclude: orderId }) });
        if (live) setMatches(response.data?.matches || []);
      } catch {
        if (live) setMatches([]);
      }
    }, 500);
    return () => { live = false; clearTimeout(timer); };
  }, [wanted, orderId]);

  if (!matches.length) return null;

  return (
    <div className="of-tracking-matches" dir="rtl">
      {matches.map((match) => {
        const who = match.customer ? `${match.customer.customerId || ''}${match.customer.name ? ` · ${match.customer.name}` : ''}` : 'بدون عميل';
        const sameCustomer = !!customerId && match.customer?.customerId === customerId;
        const link = <a href={`/invoice/${match.orderObjectId}/edit`} target="_blank" rel="noreferrer">{match.orderId}</a>;
        if (match.unsureOrder && sameCustomer) {
          return (
            <Alert key={`${match.orderObjectId}-${match.trackingNumber}`} severity="info">
              العميل نفسه بلّغ عن هذا الرقم في طرود منتظرة (الطلبية {link}). عند حفظ الفاتورة يُربط الطرد بها تلقائياً ويُحذف من الطرود المنتظرة.
            </Alert>
          );
        }
        const state = [match.isCanceled && 'ملغاة', match.received && 'الطرد مُسلَّم', match.isFinished && 'مكتملة'].filter(Boolean).join(' · ');
        return (
          <Alert key={`${match.orderObjectId}-${match.trackingNumber}`} severity="warning">
            {match.unsureOrder
              ? <>هذا الرقم بلّغ عنه <b>عميل آخر</b> ({who}) في طرود منتظرة: الطلبية {link}. تأكد من الرقم ومن العميل.</>
              : <>هذا الرقم موجود في الفاتورة {link} للعميل {who}{state ? ` (${state})` : ''}. تأكد أنه ليس إدخالاً مكرراً.</>}
          </Alert>
        );
      })}
    </div>
  );
};

export default TrackingMatches;
