import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Ltr } from './ui';

// A guarantee the bank counts inside an account's balance (the Kuveyt Turk card guarantee) while the
// books keep it in its own account. Linking it makes the statement compare with both together.
// Display only: no entry is made or changed.
export default function HeldAccountLink({ accountId, open, onClose, onSaved }: { accountId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [options, setOptions] = useState<any[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !accountId) return;
    setError('');
    acc.get('bank/held-account', { accountId })
      .then((res: any) => { setOptions(res.data.accounts || []); setValue(res.data.current ? String(res.data.current) : ''); })
      .catch((e: any) => setError(errorText(e)));
  }, [open, accountId]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await acc.put('bank/held-account', { accountId, heldAccountId: value || null });
      onSaved(); onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>ضمان يحتسبه البنك داخل الرصيد</DialogTitle>
      <DialogContent>
        <Alert severity="info" className="mb-3">
          إذا كان البنك يُظهر ضمان البطاقة ضمن رصيد هذا الحساب، والدفاتر تحفظه في حساب الضمان، اختره هنا.
          تُقارن الشاشة الكشف بمجموع الحسابين. لا يُسجَّل أي قيد ولا يتغير أي رصيد.
        </Alert>
        {error && <Alert severity="error" className="mb-3">{error}</Alert>}
        <TextField select fullWidth label="حساب الضمان" value={value} onChange={(e) => setValue(e.target.value)}>
          <MenuItem value="">بدون ضمان</MenuItem>
          {options.map((a) => <MenuItem key={a._id} value={a._id}><Ltr>{a.code}</Ltr>&nbsp;{a.name}</MenuItem>)}
        </TextField>
        {!options.length && !error && <Alert severity="warning" className="mt-3">لا يوجد حساب أصل بعملة هذا الحساب يصلح كضمان.</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button variant="contained" disableElevation onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</Button>
      </DialogActions>
    </Dialog>
  );
}
