import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';

export const localBankResetHost = () => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
export default function LocalBankReset({ accountId, lines, onDone }: { accountId: string, lines: any[], onDone: (result: any) => any }) {
  const [allowed, setAllowed] = useState(false); const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null); const [reason, setReason] = useState('إعادة تجربة نفس كشف الحساب');
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const ids = lines.map(l => l._id).join(',');
  useEffect(() => {
    let active = true;
    if (localBankResetHost()) acc.get('bank/local-reset/available').then((res: any) => { if (active) setAllowed(res.data.available === true); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { setPreview(null); setConfirmed(false); }, [ids, accountId]);
  if (!localBankResetHost() || !allowed) return null;
  const load = async () => {
    setOpen(true); setBusy(true); setPreview(null); setConfirmed(false); setError('');
    try { setPreview((await acc.post('bank/local-reset/preview', { accountId, lineIds: lines.map(l => l._id) })).data); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <>
    <Button variant="outlined" color="error" disabled={!lines.length || lines.length > 500 || busy} onClick={load}>Local: إلغاء التجربة وحذف المحدد ({lines.length})</Button>
    <Dialog open={open} fullWidth maxWidth="md" dir="rtl" onClose={() => !busy && setOpen(false)}>
      <DialogTitle>إلغاء ترحيل التجربة وحذف سطور الكشف — Local فقط</DialogTitle>
      <DialogContent>
        <Alert severity="warning">سيلغي ترحيل السطور التي أنشأت حركات مالية، ويفك المطابقات، ثم يحذف سطور الكشف حتى تستطيع استيراد الملف مجددًا. القيود المسجلة قبل الكشف تبقى موجودة؛ القيود العكسية وسجل الإلغاء محفوظان.</Alert>
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
        {busy && !preview && <p>جارٍ تجهيز المعاينة…</p>}
        {preview && <>
          <p>المحدد: {preview.requested} · المحذوف: {preview.deletedCount} · سطور لها ترحيل: {preview.canceledLines} · مطابقات محددة: {preview.matchedLines}</p>
          {!!preview.additionalLines && <Alert severity="warning">توجد {preview.additionalLines} سطور إضافية مرتبطة بتسوية جماعية أو نسخ مكررة؛ سيشملها الحذف.</Alert>}
          {!!preview.settlementCount && <Alert severity="warning">ستُلغى {preview.settlementCount} تسويات تكاليف جماعية كاملة مع سطورها.</Alert>}
          {!!preview.relatedMatches && <Alert severity="warning">ستُفك أيضًا {preview.relatedMatches} روابط كشف أخرى مرتبطة بنفس القيود، حتى لا تبقى مطابقة بقيد ملغى.</Alert>}
          <div style={{ maxHeight: 240, overflow: 'auto', margin: '12px 0' }}>{preview.rows.map((row: any) => <p key={row._id}>{row.day} · {row.description}</p>)}</div>
          <TextField fullWidth label="سبب إعادة التجربة" value={reason} onChange={e => setReason(e.target.value)} />
          <FormControlLabel control={<Checkbox checked={confirmed} onChange={(_, checked) => setConfirmed(checked)} />} label="راجعت السطور وأوافق على إلغاء ترحيلها وحذفها من قاعدة Local" />
        </>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>إلغاء</Button>
        <Button disabled={busy || !lines.length} onClick={load}>تحديث المعاينة</Button>
        <Button variant="contained" color="error" disabled={busy || !preview || !confirmed || reason.trim().length < 10} onClick={async () => {
          setBusy(true); setError('');
          try { const result = await acc.post('bank/local-reset', { accountId, lineIds: lines.map(l => l._id), fingerprint: preview.fingerprint, confirm: confirmed, reason }); setOpen(false); await onDone(result.data); }
          catch (e) { setError(errorText(e)); setPreview(null); setConfirmed(false); } finally { setBusy(false); }
        }}>إلغاء الترحيل وحذف السطور</Button>
      </DialogActions>
    </Dialog>
  </>;
}
