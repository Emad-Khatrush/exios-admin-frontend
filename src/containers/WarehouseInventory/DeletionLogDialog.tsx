import { useEffect, useState } from 'react';
import { Dialog } from '@mui/material';
import moment from 'moment';
import { ShieldAlert } from 'lucide-react';
import api from '../../api';

type Props = {
  office: string;
  officeLabel: string;
  onClose: () => void;
};

const DeletionLogDialog = ({ office, officeLabel, onClose }: Props) => {
  const [deletions, setDeletions] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('inventory/deletions', { office })
      .then((response) => setDeletions(response.data || []))
      .catch((err) => setError(err?.response?.data?.message || 'تعذر تحميل سجل الحذف.'));
  }, [office]);

  return (
    <Dialog open onClose={onClose} PaperProps={{ className: 'wh-dialog wh-dialog--wide', dir: 'rtl', lang: 'ar' }}>
      <h6>
        <ShieldAlert size={17} strokeWidth={2} />
        الطرود المحذوفة - {officeLabel}
      </h6>
      <p className="wh-dialog__note">كل طرد قام موظف أو مدير بإزالته من هذا المخزن، مع السبب. مرئي للمدراء فقط.</p>

      {error && <p className="wh-dialog__error">{error}</p>}

      <div className="wh-picker">
        {deletions === null && <p className="wh-picker__hint">جارٍ التحميل…</p>}
        {deletions?.length === 0 && <p className="wh-picker__hint">لم يتم حذف أي شيء من هذا المخزن.</p>}

        {deletions?.map((entry) => (
          <div key={entry._id} className="wh-history-row">
            <div>
              <strong>{entry.snapshot?.customerName || 'زبون غير معروف'}</strong>
              <small>
                {entry.snapshot?.trackingNumber && `${entry.snapshot.trackingNumber} · `}
                حُذف بواسطة {entry.deletedBy?.firstName} {entry.deletedBy?.lastName}، {moment(entry.createdAt).fromNow()}
              </small>
            </div>
            <p className="wh-history-row__notes">"{entry.reason}"</p>
          </div>
        ))}
      </div>

      <div className="wh-dialog__actions">
        <button type="button" className="wh-btn" onClick={onClose}>إغلاق</button>
      </div>
    </Dialog>
  );
};

export default DeletionLogDialog;
