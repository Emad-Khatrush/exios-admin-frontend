import { useState } from 'react';
import { Dialog } from '@mui/material';
import { Trash2 } from 'lucide-react';
import api from '../../api';

type Props = {
  inventoryId: string;
  order: any;
  onClose: () => void;
  onDeleted: (paymentListId: string) => void;
};

const DeletePackageDialog = ({ inventoryId, order, onClose, onDeleted }: Props) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const paymentListId = order?.paymentList?._id;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;

    try {
      setIsSubmitting(true);
      setError('');
      await api.delete(`inventory/${inventoryId}/packages/${paymentListId}`, { reason: reason.trim() });
      onDeleted(paymentListId);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر حذف هذا الطرد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={() => !isSubmitting && onClose()} PaperProps={{ className: 'wh-dialog', dir: 'rtl', lang: 'ar' }}>
      <div className="wh-dialog__icon is-danger"><Trash2 size={20} strokeWidth={2} /></div>
      <h6>هل تريد حذف هذا الطرد؟</h6>
      <p>
        {order?.customerInfo?.fullName}
        {order?.paymentList?.deliveredPackages?.trackingNumber && ` · ${order.paymentList.deliveredPackages.trackingNumber}`}
      </p>
      <p className="wh-dialog__note">سيُحذف هذا الطرد من قائمة المخزن. سيُسجَّل هذا الإجراء باسمك مع السبب أدناه، ولا يمكن لغير المدير الاطلاع على هذا السجل.</p>

      <form onSubmit={submit}>
        <label className="wh-dialog__label" htmlFor="delete-reason">سبب الحذف *</label>
        <textarea
          id="delete-reason"
          rows={3}
          required
          placeholder="مثال: تم إرجاع الطرد للزبون، تلف وتم التخلص منه، أُضيف بالخطأ..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isSubmitting}
        />

        {error && <p className="wh-dialog__error">{error}</p>}

        <div className="wh-dialog__actions">
          <button type="button" className="wh-btn" onClick={onClose} disabled={isSubmitting}>إلغاء</button>
          <button type="submit" className="wh-btn wh-btn--danger" disabled={isSubmitting || !reason.trim()}>
            {isSubmitting ? 'جارٍ الحذف…' : 'حذف الطرد'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default DeletePackageDialog;
