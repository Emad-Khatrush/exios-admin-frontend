import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Ltr, Money, Open, Panel } from './ui';

export default function BankDuplicateSettlement({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: (text: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    acc.get('bank/duplicate-settlement', { accountId }).then((res: any) => { if (active) setData(res.data); }).catch((err: any) => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [accountId]);
  const chosen = (data?.candidates || []).filter((c: any) => selected.includes(c.key));
  const restored = chosen.reduce((sum: number, c: any) => sum + c.amount, 0);
  const apply = async () => {
    setSaving(true); setError('');
    try {
      const res = await acc.post('bank/duplicate-settlement', { accountId, items: chosen.map((c: any) => ({ lineId: c.lineId, paymentId: c.paymentId, fingerprint: c.fingerprint })), reason: reason.trim(), confirmSameOperation: confirmed });
      onDone(`تمت تسوية ${res.data.settled} تكرار وربط سطور الكشف بالدفعات الموجودة.`);
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };
  return <Dialog open fullWidth maxWidth="lg" dir="rtl" onClose={() => !saving && onClose()}>
    <DialogTitle>تسوية التكرار · {data?.account.name || ''}</DialogTitle>
    <DialogContent>
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      <Alert severity="info" className="mb-3">اختر الحوالات التي خُصمت مرتين فعلًا. ستُعكس دفعة الكشف القديمة وفاتورة المصروف المنشأة منها، ثم يُربط السطر بالدفعة المجمعة الموجودة. فواتير الطلبيات وشراء اليوان المرتبط بالدفعة المجمعة تبقى كما هي.</Alert>
      <Alert severity="warning" className="mb-3">تشابه المبلغ وقرب التاريخ لا يثبتان أنها نفس الحوالة. راجع المستلم والمراجع قبل التأكيد. الدفعة التي لا يوجد لها سطر كشف لن تظهر هنا.</Alert>
      {!data && !error && <p>جارٍ تحميل المعاينة…</p>}
      {data && !data.candidates.length && <Alert severity="info">لا توجد حالات قابلة للتسوية بهذا الإجراء. يدعم دفعة مجمعة مقابل مصروف منشأ من سطر كشف بالدولار بعد الجرد، ولا يشمل الفواتير الموزعة أو التسويات التاريخية.</Alert>}
      {(data?.candidates || []).map((c: any) => {
        const blocked = chosen.some((other: any) => other.key !== c.key && (other.lineId === c.lineId || other.paymentId === c.paymentId));
        return <Panel key={c.key} title={`${c.description} · ${c.statementDay}`}>
          <FormControlLabel control={<Checkbox checked={selected.includes(c.key)} disabled={saving || blocked} onChange={e => { setConfirmed(false); setSelected(e.target.checked ? [...selected, c.key] : selected.filter(key => key !== c.key)); }} />} label={<>تسوية مبلغ <Money value={c.amount} /></>} />
          <p>سيُعكس: الدفعة <Ltr>{c.oldPayment}</Ltr> وقيدها <Ltr>{c.oldEntry}</Ltr> وفاتورة المصروف <Ltr>{c.oldBill}</Ltr> · المورد: {c.oldVendor}</p>
          <p>ستبقى: الدفعة المجمعة <Ltr>{c.paymentNumber}</Ltr> بتاريخ <Ltr>{c.paymentDay}</Ltr> · المورد: {c.vendor}</p>
          {c.vendorDiffers && <Alert severity="warning" className="mb-2">المورد في التسجيل القديم مختلف عن مورد الدفعة المجمعة. أكد من مرجع الحوالة أنها نفس العملية وليستا دفعتين مستقلتين.</Alert>}
          <p>الفواتير التي ستبقى مسددة: {c.retainedBills.map((b: any) => <span key={b.id} className="mx-2"><Open to={`/accounting/bills/${b.id}`}><Ltr>{b.number}</Ltr></Open> · <Money value={b.usd} /></span>)}</p>
          {c.retainedPurchases.map((p: any) => <p key={p.number}>شراء اليوان المحفوظ: <Ltr>{p.number}</Ltr> · <Money value={p.usd} /> · {p.cny ? <Ltr>{p.cny} CNY</Ltr> : 'الكمية عند الوصول'} · {p.arrived ? 'وصل' : 'بانتظار الوصول'}</p>)}
        </Panel>;
      })}
      {data && <Panel title="أثر الحالات المختارة على الرصيد">
        <p>الرصيد الحالي: <Money value={data.balance} /></p>
        <p>الخصم الزائد الذي سيُعكس: <Money value={restored} /></p>
        <p>الرصيد المتوقع بعد التسوية: <Money value={data.balance + restored} strong /></p>
      </Panel>}
      {!!chosen.length && <>
        <TextField fullWidth multiline minRows={2} label="سبب التصحيح" disabled={saving} value={reason} onChange={e => setReason(e.target.value)} />
        <FormControlLabel control={<Checkbox disabled={saving} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />} label="راجعت الحوالات وأؤكد أن كل زوج مختار هو نفس العملية، وأن فاتورة المصروف القديمة تكلفة مكررة" />
      </>}
    </DialogContent>
    <DialogActions>
      <Button disabled={saving} onClick={onClose}>إغلاق</Button>
      <Button variant="contained" disabled={saving || !chosen.length || !confirmed || reason.trim().length < 10} onClick={apply}>{saving ? 'جارٍ التسوية…' : 'تأكيد تسوية التكرار'}</Button>
    </DialogActions>
  </Dialog>;
}
