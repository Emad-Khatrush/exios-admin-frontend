import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import api from '../../api';

type Match = {
  trackingNumber: string
  orderObjectId: string
  orderId: string
  unsureOrder: boolean
  isCanceled: boolean
  isFinished: boolean
  received: boolean
  shipmentMethod?: string | null
  customer: { customerId?: string, name?: string } | null
};

type Props = {
  number: string
  // The order being edited (left out of the search) and its customer
  orderId?: string
  customerId?: string
  // The method staff picked for this package, compared with the customer's choice
  method?: string
  // Puts this order on the customer who reported the number (shown for another customer's waiting package)
  onUseCustomer?: (customerId: string) => void
};

const normalize = (value: string) => String(value || '').replace(/\s+/g, '').toLowerCase();
const METHODS: Record<string, string> = { air: 'جوي', sea: 'بحري', unknown: 'غير محدد' };
const methodName = (method?: string | null) => METHODS[String(method || 'unknown')] || String(method);

// Where else the tracking number being typed already is: a customer's waiting package (طرود منتظرة)
// or another order. A warning only; saving is never stopped. Each one opens in a new tab.
const TrackingMatches = ({ number, orderId, customerId, method, onUseCustomer }: Props) => {
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
        // The customer's choice of method, and a note when staff picked another one
        const chosen = match.unsureOrder && (
          <> طريقة الشحن التي اختارها العميل: <b>{methodName(match.shipmentMethod)}</b>
            {method && match.shipmentMethod && match.shipmentMethod !== 'unknown' && method !== match.shipmentMethod && <> (تختلف عن {methodName(method)} المختارة هنا)</>}.</>
        );
        const link = <a href={`/invoice/${match.orderObjectId}/edit`} target="_blank" rel="noreferrer">{match.orderId}</a>;
        if (match.unsureOrder && sameCustomer) {
          return (
            <Alert key={`${match.orderObjectId}-${match.trackingNumber}`} severity="info">
              العميل نفسه بلّغ عن هذا الرقم في طرود منتظرة (الطلبية {link}). عند حفظ الفاتورة يُربط الطرد بها تلقائياً ويُحذف من الطرود المنتظرة.{chosen}
            </Alert>
          );
        }
        const state = [match.isCanceled && 'ملغاة', match.received && 'الطرد مُسلَّم', match.isFinished && 'مكتملة'].filter(Boolean).join(' · ');
        const otherCode = match.unsureOrder && match.customer?.customerId;
        return (
          <Alert
            key={`${match.orderObjectId}-${match.trackingNumber}`} severity="warning"
            action={otherCode && onUseCustomer ? (
              <Button color="inherit" size="small" type="button" onClick={() => onUseCustomer(String(otherCode))}>اربط الطلبية بكود هذا العميل ({otherCode})</Button>
            ) : undefined}
          >
            {match.unsureOrder
              ? <>هذا الرقم بلّغ عنه <b>عميل آخر</b> ({who}) في طرود منتظرة: الطلبية {link}. تأكد من الرقم ومن العميل.{chosen}</>
              : <>هذا الرقم موجود في الفاتورة {link} للعميل {who}{state ? ` (${state})` : ''}. تأكد أنه ليس إدخالاً مكرراً.</>}
          </Alert>
        );
      })}
    </div>
  );
};

export default TrackingMatches;
