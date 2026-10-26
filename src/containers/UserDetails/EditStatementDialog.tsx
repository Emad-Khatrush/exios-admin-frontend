import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, ListSubheader, MenuItem, Select, TextField } from '@mui/material';
import api from '../../api';
import { sys } from '../Accounting/accountingApi';
import { formatMoney, getOfficeLabel, useDepositPlaces } from './statementUtils';

type Props = {
  open: boolean
  statement: any
  onClose: () => void
  onSaved: () => void
}

// The kinds an incoming line can be changed to: money in (cash, bank) or given (refund, compensation).
// A payment given back and a withdrawal are made by their own actions, not by retyping a line.
const actionTypes = ['cash', 'bank', 'refund', 'compensation'];

const toForm = (statement: any) => ({
  createdAt: statement?.createdAt ? new Date(statement.createdAt) : new Date(),
  amount: String(statement?.amount ?? ''),
  description: statement?.description || '',
  note: statement?.note || '',
  office: statement?.office || '',
  actionType: statement?.calculationType === '-' && statement?.paymentType === 'withdrawal' ? 'withdrawal' : statement?.actionType || '',
  withdrawalSource: statement?.withdrawalSource || 'box',
  rate: statement?.rate ? String(statement.rate) : '',
  // The account the money went to (a partner's current account such as Wasl), else the office's box
  accountId: statement?.accountId ? String(statement.accountId._id || statement.accountId) : '',
});

const EditStatementDialog = ({ open, statement, onClose, onSaved }: Props) => {
  const { id } = useParams();
  const [form, setForm] = useState(toForm(statement));
  const [editRevision, setEditRevision] = useState(statement?.editHistory?.length || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isWithdrawal = statement?.calculationType === '-' && (statement?.actionType === 'withdrawal' || statement?.paymentType === 'withdrawal');
  const allPlaces = useDepositPlaces(statement?.currency);
  const places = isWithdrawal ? allPlaces?.filter(place => place.kind === 'office') : allPlaces;
  // The office saved on the line stays listed even when it has no box in this currency any more
  const savedOffice = statement?.office && places && !places.some((p) => p.value === statement.office) ? statement.office : '';
  // Accounts a deposit can go to, as in the deposit form: partners' current accounts (Wasl)
  const [accounts, setAccounts] = useState<any[]>([]);
  useEffect(() => {
    if (!open || !statement?.currency) return;
    sys.get('acc/money-accounts', { currency: statement.currency })
      .then((res: any) => setAccounts(res.data.results || []))
      .catch(() => setAccounts([]));
  }, [open, statement?.currency]);
  const currentAccounts = accounts.filter((a) => a.kind === 'current' || a._id === form.accountId);
  // The saved account is an option before the list arrives, so the select never holds a value it lacks
  const savedAccount = statement?.accountId && !accounts.some((a) => a._id === toForm(statement).accountId)
    ? { _id: toForm(statement).accountId, name: statement.accountId.name || 'حساب جارٍ' } : null;
  const accountOptions = savedAccount ? [...currentAccounts, savedAccount] : currentAccounts;
  const chosenAccount = accounts.find((a) => a._id === form.accountId);
  const movedToAccount = !!form.accountId && form.accountId !== toForm(statement).accountId;

  useEffect(() => {
    if (open) {
      setForm(toForm(statement));
      setEditRevision(statement?.editHistory?.length || 0);
      setError('');
    }
  }, [open, statement]);

  const setField = (name: string, value: any) => setForm((prev) => ({ ...prev, [name]: value }));

  const isOutflow = statement?.calculationType === '-';
  const newAmount = Number(form.amount);
  const amountDelta = Number.isFinite(newAmount) ? newAmount - Number(statement?.amount || 0) : 0;
  // A bigger deposit adds to the wallet, a bigger payment takes from it
  const walletDelta = isOutflow ? -amountDelta : amountDelta;
  const original = toForm(statement);
  const hasChanges = (Object.keys(form) as (keyof typeof form)[]).some(key => {
    if (key === 'createdAt') return new Date(form.createdAt).getTime() !== new Date(original.createdAt).getTime();
    if (key === 'amount' || key === 'rate') return Number(form[key] || 0) !== Number(original[key] || 0);
    return String(form[key] ?? '') !== String(original[key] ?? '');
  });

  const save = async () => {
    if (isSaving || !hasChanges) return;
    if (!form.description.trim()) return setError('Description is required.');
    if (!Number.isFinite(newAmount) || newAmount <= 0) return setError('Amount must be greater than 0.');
    if (!form.createdAt || isNaN(new Date(form.createdAt).getTime())) return setError('Pick a valid date.');
    if (isWithdrawal && form.withdrawalSource === 'box' && !form.office) return setError('اختر مكتب الصرف المرتبط بخزينة');

    try {
      setIsSaving(true);
      setError('');
      await api.update(`user/${id}/statement/${statement._id}`, {
        ...form,
        ...(isWithdrawal && { expectedEditCount: editRevision }),
        accountId: form.accountId || null,
        amount: newAmount,
        createdAt: new Date(form.createdAt),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.log(err);
      setError(err?.response?.data?.message || 'Could not save the changes. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onClose={() => !isSaving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.05rem' }}>{isWithdrawal ? 'تعديل السحب النقدي' : 'Edit payment'}</DialogTitle>
      <DialogContent>
        <div className="cashflow-edit">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Date"
              inputFormat="dd/MM/yyyy"
              value={form.createdAt}
              renderInput={(params: any) => <TextField {...params} size="small" fullWidth />}
              onChange={(value: any) => setField('createdAt', value)}
            />
          </LocalizationProvider>

          <TextField
            label={isOutflow ? 'Amount paid' : 'Amount received'}
            size="small"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={form.amount}
            onChange={(event) => setField('amount', event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">{statement?.currency}</InputAdornment> }}
            fullWidth
          />

          {isWithdrawal && <TextField select size="small" fullWidth label="مصدر الصرف" value={form.withdrawalSource} disabled={isSaving}
            onChange={event => setField('withdrawalSource', event.target.value)} helperText="اختيار العهدة يخص الموظف الذي سجّل السحب الأصلي.">
            <MenuItem value="box">خزينة الفرع</MenuItem><MenuItem value="custody">عهدة الموظف الذي سجّل السحب</MenuItem>
          </TextField>}
          {(!isWithdrawal || form.withdrawalSource !== 'custody') && <FormControl size="small" fullWidth>
            <InputLabel id="edit-office-label">Office</InputLabel>
            <Select
              labelId="edit-office-label"
              label="Office"
              value={!isWithdrawal && form.accountId ? `account:${form.accountId}` : form.office}
              onChange={(event) => {
                const value = String(event.target.value);
                // A current account: the money is there; its office is only where it is recorded
                if (value.startsWith('account:')) {
                  const account = accounts.find((a) => `account:${a._id}` === value);
                  return setForm((prev) => ({ ...prev, accountId: account?._id || '', office: account?.office || prev.office }));
                }
                return setForm((prev) => ({ ...prev, accountId: '', office: value }));
              }}
            >
              {!isWithdrawal && <MenuItem value=""><em>No office</em></MenuItem>}
              {savedOffice ? <MenuItem value={savedOffice} disabled>{getOfficeLabel(savedOffice)} (no {statement?.currency} box)</MenuItem> : null}
              {(places || []).map((office) => (
                <MenuItem key={office.value} value={office.value}>{office.label}</MenuItem>
              ))}
              {!isWithdrawal && accountOptions.length > 0 ? <ListSubheader>حسابات جارية</ListSubheader> : null}
              {!isWithdrawal && accountOptions.map((account) => (
                <MenuItem key={account._id} value={`account:${account._id}`}>{account.name}</MenuItem>
              ))}
            </Select>
          </FormControl>}
          {!isWithdrawal && movedToAccount && <Alert severity="info" className="cashflow-edit__wide" dir="rtl">
            يُنقل الإيداع إلى «{chosenAccount?.name}»: يُعكس قيده القديم ويُسجّل على هذا الحساب بنفس التاريخ والمبلغ، ثم يُطابق مع سطر كشفه إن كان مستورداً. رصيد المحفظة لا يتغير.
            {!['cash', 'bank'].includes(form.actionType) && ' نوع العملية يجب أن يكون cash أو bank.'}
          </Alert>}

          <FormControl size="small" fullWidth>
            <InputLabel id="edit-action-label">Action type</InputLabel>
            <Select
              labelId="edit-action-label"
              label="Action type"
              value={form.actionType}
              disabled={isWithdrawal}
              onChange={(event) => setField('actionType', event.target.value)}
            >
              {!isWithdrawal && <MenuItem value=""><em>None</em></MenuItem>}
              {(isWithdrawal ? ['withdrawal'] : actionTypes).map((type) => (
                <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {isWithdrawal && statement?.currency !== 'USD' && <TextField size="small" fullWidth type="number" label="سعر الصرف مقابل الدولار" value={form.rate}
            inputProps={{ min: 0, step: 'any' }} helperText="اختياري؛ فارغ = سعر تاريخ العملية." onChange={event => setField('rate', event.target.value)} />}
          {isWithdrawal && <Alert severity="info" className="cashflow-edit__wide" dir="rtl">يُعكس القيد السابق ويُسجّل السحب المصحح مع تعديل المحفظة. إذا تعذّر الترحيل يُرفض التعديل كاملًا.</Alert>}

          <TextField
            className="cashflow-edit__wide"
            label="Description"
            size="small"
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            inputProps={{ dir: 'rtl' }}
            multiline
            minRows={2}
            fullWidth
          />

          <TextField
            className="cashflow-edit__wide"
            label="Note"
            size="small"
            value={form.note}
            onChange={(event) => setField('note', event.target.value)}
            inputProps={{ dir: 'rtl' }}
            multiline
            minRows={2}
            fullWidth
          />
        </div>

        {amountDelta !== 0 && Number.isFinite(newAmount) && newAmount > 0 &&
          <p className="cashflow-confirm__hint mt-3">
            The {statement?.currency} wallet balance will change by{' '}
            <strong>{walletDelta > 0 ? '+' : '−'}{formatMoney(Math.abs(walletDelta), statement?.currency)}</strong>.
          </p>
        }
        {error && <p className="cashflow-confirm__error" role="alert">{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button disabled={isSaving} onClick={onClose}>Cancel</Button>
        <Button disabled={isSaving || !hasChanges} variant="contained" disableElevation onClick={save}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditStatementDialog;
