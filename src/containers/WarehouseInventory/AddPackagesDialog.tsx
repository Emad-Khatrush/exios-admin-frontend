import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@mui/material';
import { Package, Search } from 'lucide-react';
import api from '../../api';

type Props = {
  inventoryId: string;
  officeLabel: string;
  onClose: () => void;
  onAdded: () => void;
};

const fullName = (order: any) => order?.customerInfo?.fullName || 'غير معروف';

const AddPackagesDialog = ({ inventoryId, officeLabel, onClose, onAdded }: Props) => {
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!searchValue.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await api.get('inventory/orders', { searchValue, inventoryId });
        setResults(response.data || []);
      } catch (err) {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchValue, inventoryId]);

  const toggle = (order: any) => {
    const id = order.paymentList?._id;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = order;
      return next;
    });
  };

  const selectedCount = Object.keys(selected).length;

  const submit = async () => {
    if (selectedCount === 0) return;
    try {
      setIsSubmitting(true);
      setError('');
      const payload = Object.values(selected).map((order: any) => ({ paymentList: { _id: order.paymentList._id } }));
      await api.update(`inventory/orders?id=${inventoryId}`, payload);
      onAdded();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إضافة هذه الطرود.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={() => !isSubmitting && onClose()} PaperProps={{ className: 'wh-dialog wh-dialog--wide', dir: 'rtl', lang: 'ar' }}>
      <h6>إضافة طرود إلى {officeLabel}</h6>
      <p className="wh-dialog__note">ابحث باسم الزبون أو رقم الطلب أو رقم التتبع أو الإيصال أو الموقع، ثم اختر الطرود التي وصلت فعليًا إلى هنا.</p>

      <label className="wh-search">
        <Search size={14} strokeWidth={2} />
        <input
          type="search"
          autoFocus
          placeholder="ابحث عن طرود غير موجودة في مخزن بعد"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </label>

      <div className="wh-picker">
        {isSearching && <p className="wh-picker__hint">جارٍ البحث…</p>}

        {!isSearching && searchValue.trim() && results.length === 0 &&
          <div className="wh-picker__empty">
            <Package size={22} strokeWidth={1.5} />
            لا توجد طرود مطابقة، أو أنها موجودة بالفعل في مخزن.
          </div>
        }

        {!searchValue.trim() &&
          <p className="wh-picker__hint">اكتب بعض الأحرف على الأقل للبحث.</p>
        }

        {results.map((order) => {
          const id = order.paymentList?._id;
          const pkg = order.paymentList?.deliveredPackages || {};
          return (
            <label key={id} className="wh-picker__row">
              <input type="checkbox" checked={!!selected[id]} onChange={() => toggle(order)} />
              <span>
                <strong>{fullName(order)}</strong>
                <small>
                  {order.orderId && `طلب ${order.orderId}`}
                  {pkg.trackingNumber && ` · ${pkg.trackingNumber}`}
                  {pkg.weight?.total ? ` · ${pkg.weight.total} ${pkg.weight.measureUnit}` : ''}
                </small>
              </span>
            </label>
          );
        })}
      </div>

      {error && <p className="wh-dialog__error">{error}</p>}

      <div className="wh-dialog__actions">
        <button type="button" className="wh-btn" onClick={onClose} disabled={isSubmitting}>إلغاء</button>
        <button type="button" className="wh-btn wh-btn--primary" onClick={submit} disabled={isSubmitting || selectedCount === 0}>
          {isSubmitting ? 'جارٍ الإضافة…' : `إضافة ${selectedCount || ''} طرد`}
        </button>
      </div>
    </Dialog>
  );
};

export default AddPackagesDialog;
