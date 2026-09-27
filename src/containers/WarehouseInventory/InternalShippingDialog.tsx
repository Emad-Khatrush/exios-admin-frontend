import { useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import moment from 'moment-timezone';
import { CheckCircle2, ChevronDown, SquareArrowOutUpRight, Truck } from 'lucide-react';
import api from '../../api';

type Office = 'tripoli' | 'benghazi';

type Props = {
  office: Office;
  officeLabel: string;
  offices: { value: Office; label: string }[];
  orders: any[];
  onClose: () => void;
  // Called after the shipment is created, with the packages that left the warehouse
  onShipped: (paymentListIds: string[]) => void;
};

const fullName = (order: any) => order?.customerInfo?.fullName || 'غير معروف';

const cleanNumber = (value: number) => String(Math.round(value * 1000) / 1000);

// Warehouse > selected packages > شحن داخلي: move them into a new domestic inventory
const InternalShippingDialog = ({ office, officeLabel, offices, orders, onClose, onShipped }: Props) => {
  const otherOffice = offices.find((item) => item.value !== office)?.value || office;
  const labelOf = (value: Office) => offices.find((item) => item.value === value)?.label || value;

  const [destination, setDestination] = useState<Office>(otherOffice);
  const [voyage, setVoyage] = useState(`شحن داخلي ${officeLabel} - ${labelOf(otherOffice)} ${moment().format('DD/MM/YYYY')}`);
  const [voyageEdited, setVoyageEdited] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ _id: string; voyage: string; movedCount: number } | null>(null);

  const summary = useMemo(() => {
    const weights = new Map<string, number>();
    const customers = new Set<string>();
    orders.forEach((order) => {
      const weight = order?.paymentList?.deliveredPackages?.weight || {};
      const unit = weight.measureUnit || '';
      weights.set(unit, (weights.get(unit) || 0) + (Number(weight.total) || 0));
      customers.add(String(order?.user?._id || order?.user?.customerId || fullName(order)));
    });
    const weightText = Array.from(weights.entries())
      .filter(([, total]) => total > 0)
      .map(([unit, total]) => `${cleanNumber(total)} ${unit}`.trim())
      .join(' + ') || '-';
    return { weightText, customers: customers.size };
  }, [orders]);

  const pickDestination = (value: Office) => {
    setDestination(value);
    // Keep the suggested name in step with the destination until the user types their own
    if (!voyageEdited) {
      setVoyage(`شحن داخلي ${officeLabel} - ${labelOf(value)} ${moment().format('DD/MM/YYYY')}`);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!voyage.trim() || orders.length === 0) return;

    try {
      setIsSubmitting(true);
      setError('');
      const paymentListIds = orders.map((order) => order?.paymentList?._id).filter(Boolean);
      const response = await api.post(`warehouse/${office}/internalShipping`, {
        paymentListIds,
        destination,
        voyage: voyage.trim(),
        note: note.trim(),
      });
      setCreated(response.data);
      onShipped(paymentListIds);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إنشاء رحلة الشحن الداخلي. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (created) {
    return (
      <Dialog open onClose={onClose} PaperProps={{ className: 'wh-dialog', dir: 'rtl', lang: 'ar' }}>
        <div className="wh-dialog__done">
          <CheckCircle2 size={36} strokeWidth={1.75} className="wh-dialog__done-icon" style={{ justifySelf: 'center' }} />
          <h6>تم إنشاء رحلة الشحن الداخلي</h6>
          <p>
            نُقل {created.movedCount} طرد إلى قائمة الجرد «{created.voyage}» وأُزيلت من مخزن {officeLabel}.
          </p>
          <div className="wh-dialog__actions">
            <a className="wh-btn" href={`/inventory/${created._id}/edit`} target="_blank" rel="noreferrer">
              <SquareArrowOutUpRight size={14} strokeWidth={2} />
              فتح قائمة الجرد
            </a>
            <button type="button" className="wh-btn wh-btn--primary" onClick={onClose}>تم</button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={() => !isSubmitting && onClose()} PaperProps={{ className: 'wh-dialog wh-dialog--wide', dir: 'rtl', lang: 'ar' }}>
      <form onSubmit={submit}>
        <h6>
          <Truck size={18} strokeWidth={2} />
          إنشاء رحلة شحن داخلي من مخزن {officeLabel}
        </h6>
        <p className="wh-dialog__note">
          تُنشأ قائمة جرد جديدة من نوع «شحن داخلي» تحتوي الطرود المحددة، ثم تُزال هذه الطرود من مخزن {officeLabel}.
        </p>

        <div className="wh-ship-summary">
          <div><strong>{orders.length}</strong><span>طرد</span></div>
          <div><strong>{summary.customers}</strong><span>زبون</span></div>
          <div><strong dir="ltr">{summary.weightText}</strong><span>الوزن الإجمالي</span></div>
        </div>

        <span className="wh-dialog__label" id="wh-ship-destination">الوجهة</span>
        <div className="wh-choice" role="radiogroup" aria-labelledby="wh-ship-destination">
          {offices.map((item) => (
            <label key={item.value} className={destination === item.value ? 'is-checked' : undefined}>
              <input
                type="radio"
                name="destination"
                value={item.value}
                checked={destination === item.value}
                onChange={() => pickDestination(item.value)}
              />
              مكتب {item.label}
            </label>
          ))}
        </div>

        <label className="wh-dialog__label" htmlFor="wh-ship-voyage">اسم أو رقم الرحلة</label>
        <input
          id="wh-ship-voyage"
          type="text"
          required
          value={voyage}
          onChange={(event) => { setVoyage(event.target.value); setVoyageEdited(true); }}
        />

        <label className="wh-dialog__label" htmlFor="wh-ship-note">ملاحظات <small>(اختياري)</small></label>
        <textarea
          id="wh-ship-note"
          rows={3}
          placeholder="اسم السائق، رقم السيارة، رقم الهاتف…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <details className="wh-ship-list">
          <summary>
            الطرود التي ستخرج من المخزن ({orders.length})
            <ChevronDown size={15} strokeWidth={2} />
          </summary>
          <ul>
            {orders.map((order) => {
              const pkg = order?.paymentList?.deliveredPackages || {};
              return (
                <li key={order?.paymentList?._id || order?._id}>
                  <strong>{fullName(order)}</strong>
                  <small>
                    {order?.orderId && `طلب ${order.orderId}`}
                    {pkg.trackingNumber && ` · ${pkg.trackingNumber}`}
                    {pkg.weight?.total ? ` · ${pkg.weight.total} ${pkg.weight.measureUnit || ''}` : ''}
                  </small>
                </li>
              );
            })}
          </ul>
        </details>

        {error && <p className="wh-dialog__error" role="alert">{error}</p>}

        <div className="wh-dialog__actions">
          <button type="button" className="wh-btn" onClick={onClose} disabled={isSubmitting}>إلغاء</button>
          <button
            type="submit"
            className="wh-btn wh-btn--primary"
            disabled={isSubmitting || !voyage.trim() || orders.length === 0}
          >
            <Truck size={14} strokeWidth={2} />
            {isSubmitting ? 'جارٍ الإنشاء…' : `إنشاء الرحلة ونقل ${orders.length} طرد`}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default InternalShippingDialog;
