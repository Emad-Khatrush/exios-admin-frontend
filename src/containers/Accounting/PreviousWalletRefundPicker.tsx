import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { acc, sys, errorText } from './accountingApi';

export default function PreviousWalletRefundPicker({ orderId, day, walletUsd, bank = false, onChange, preferredId = '' }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [automaticId, setAutomaticId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    let stale = false;
    setSelected(''); setConfirmed(false); setRows([]); setAutomaticId(''); setError('');
    if (!orderId) { setBusy(false); change.current({}); return undefined; }
    setBusy(true); change.current({ loading: true });
    const timer = window.setTimeout(() => {
      const request = bank ? acc.get('bank/previous-wallet-refunds', { orderId, day, walletUsd })
        : sys.get(`acc/orders/${orderId}/previous-wallet-refunds`, { day, walletUsd });
      request.then((res: any) => { if (!stale) {
        const results = res.data.results || []; setRows(results); setAutomaticId(res.data.automaticId || '');
        if (preferredId) {
          if (results.some((row: any) => row._id === preferredId)) setSelected(preferredId);
          else setError('الحركة المختارة غير متاحة لهذه الطلبية؛ راجع الطلبية أو اختر حركة أخرى');
        }
      } })
        .catch((err: any) => { if (!stale) setError(errorText(err)); })
        .finally(() => { if (!stale) setBusy(false); });
    }, 200);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [orderId, day, walletUsd, bank, preferredId]);
  useEffect(() => {
    change.current({ legacyWalletStatementId: selected || undefined, confirmLegacyRefund: !!selected && confirmed,
      confirmNewWalletRefund: !selected && confirmed, loading: busy, blocked: !!error || (rows.length > 0 && !confirmed) });
  }, [selected, confirmed, busy, error, rows]);
  return <div className="my-3">
    {busy && <Alert severity="info">جارٍ البحث عن الريفاند والتعويضات السابقة...</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {!busy && !error && rows.length > 0 && <>
      <Alert severity="warning" className="mb-2">توجد إضافات سابقة لمحفظة هذا العميل. اختر الموجودة إذا كانت تخص هذا الاسترداد، ولن نضيف المبلغ مرة ثانية.</Alert>
      <TextField select fullWidth label="ريفاند أو تعويض سابق غير مرتبط" value={selected} onChange={e => { setSelected(e.target.value); setConfirmed(false); }}>
        <MenuItem value="">لا أربط حركة سابقة</MenuItem>
        {rows.map(row => <MenuItem key={row._id} value={row._id}>{row.kind === 'compensation' ? 'تعويض' : 'Refund'} · {row.amount} {row.currency} · {row.day} · {row.description}{row.sameOrder ? ' · نفس الطلبية' : ''}</MenuItem>)}
      </TextField>
      {automaticId && <Button className="mt-2" onClick={() => { setSelected(automaticId); setConfirmed(true); }}>اختيار المطابقة الواضحة تلقائيًا</Button>}
      <FormControlLabel control={<Checkbox checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />} label={selected ? 'أؤكد أن هذه الحركة تخص الاسترداد الحالي، دون إضافة للمحفظة مجددًا' : 'راجعت الحركات السابقة؛ هذه عملية مستقلة عنها'} />
      {selected && <Alert severity="info">سيُحفظ ربط الحركة السابقة فقط. رصيد العميل وقيد الإضافة السابق لا يتغيران.</Alert>}
    </>}
    {!busy && !error && orderId && rows.length === 0 && <Alert severity="info">لا توجد Refund أو تعويضات سابقة متاحة للربط لهذا العميل.</Alert>}
  </div>;
}
