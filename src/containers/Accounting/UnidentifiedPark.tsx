import { useState } from 'react';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Ltr, Money, Sub } from './ui';
import { isBeforeCount, useCountDay } from '../../utils/useCountDay';

// "لا أعرف بعد": a bank line nobody can explain yet. Its money is recorded now on a waiting account,
// so the bank balance is right, and nothing reaches profit until it is explained or decided.
export const PARK_HINTS: Record<string, { label: string, direction: 'in' | 'out' | 'any' }> = {
  purchase: { label: 'غالباً مشتريات', direction: 'out' },
  shipping: { label: 'غالباً شحن أو رحلة', direction: 'out' },
  expense: { label: 'غالباً مصروف أو رسوم', direction: 'out' },
  refund: { label: 'غالباً ريفاند من مورد', direction: 'in' },
  customer: { label: 'غالباً إيداع عميل', direction: 'in' },
  unknown: { label: 'لا فكرة', direction: 'any' },
};

type Props = { line: any, currency: string, decimals: number, liability?: boolean, maybeDuplicate?: boolean, onClose: () => void, onDone: () => void };

export default function UnidentifiedPark({ line, currency, decimals, liability, maybeDuplicate, onClose, onDone }: Props) {
  const out = line.amount < 0;
  const count = useCountDay();
  const beforeCount = isBeforeCount(count, line.day);
  // A card is money owed: spending raises it, a refund lowers it
  const bankEffect = liability ? (out ? 'يزيد المستحق على البطاقة' : 'ينقص المستحق على البطاقة') : (out ? 'ينقص رصيد البنك' : 'يزيد رصيد البنك');
  const [hint, setHint] = useState('unknown');
  const [note, setNote] = useState('');
  const [notDuplicate, setNotDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const waiting = hint === 'refund' ? 'استردادات موردين قيد التحديد' : out ? 'مدفوعات قيد التحديد' : 'مقبوضات قيد التحديد';
  const save = async () => {
    setBusy(true); setError('');
    try {
      await acc.post(`bank/lines/${line._id}/park`, { hint, note, confirmNotDuplicate: notDuplicate });
      onDone();
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>لا أعرف هذه الحركة بعد<Sub><Ltr>{line.day}</Ltr> · {line.description} · <Money value={line.amount} currency={currency} decimals={decimals} tone={out ? 'credit' : 'debit'} strong /></Sub></DialogTitle>
      <DialogContent dividers>
        <div className="mb-2 fw-bold">ما الذي تظنه؟ <span className="acc-sub">(اختياري، يساعد النظام على اقتراح الحل لاحقاً)</span></div>
        <Stack direction="row" flexWrap="wrap" gap={1} className="mb-3">
          {Object.entries(PARK_HINTS).filter(([, h]) => h.direction === 'any' || h.direction === (out ? 'out' : 'in')).map(([key, h]) => (
            <Chip key={key} label={h.label} color={hint === key ? 'primary' : 'default'} variant={hint === key ? 'filled' : 'outlined'} onClick={() => setHint(key)} />
          ))}
        </Stack>
        <TextField fullWidth multiline minRows={2} size="small" label="ملاحظة (ما فحصته، من سألت)" value={note} onChange={e => setNote(e.target.value)} />
        <Alert severity="info" className="mt-3">
          <b>ما سيحدث:</b> {bankEffect} في الدفاتر بمبلغ الحركة الآن، ويُسجّل المبلغ في حساب «{waiting}» حتى نعرفه.
          لا يتأثر الربح، ولا يُنسب لعميل أو طلبية. عندما تُضيف لاحقاً {out ? 'المشتريات أو تكلفة الرحلة' : 'الريفاند أو الإيداع'} الصحيح، يُسوّى من هذا الحساب دون أن يتحرك البنك مرة ثانية.
          {' '}إن لم يُعرف خلال {out ? '90 يوماً' : 'سنة'}، يقرر المالك تصنيفه.
        </Alert>
        {beforeCount && count && <Alert severity="warning" className="mt-2">تاريخ الحركة قبل الجرد (<Ltr>{count.day}</Ltr>)، والجرد احتسب أثرها على {liability ? 'البطاقة' : 'البنك'}. لذلك لن يتغير رصيد {liability ? 'البطاقة' : 'البنك'}؛ يُسجّل المبلغ مقابل الأرصدة الافتتاحية، ويبقى في حساب الانتظار حتى يُعرف أو يُقرر.</Alert>}
        {maybeDuplicate && <FormControlLabel className="mt-2" control={<Checkbox checked={notDuplicate} onChange={e => setNotDuplicate(e.target.checked)} />} label="في الدفاتر قيد بنفس المبلغ قريب من التاريخ؛ راجعته وهذه حركة مختلفة" />}
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || (maybeDuplicate && !notDuplicate)} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'سجّلها قيد التحديد'}</Button>
      </DialogActions>
    </Dialog>
  );
}
