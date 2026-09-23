import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import api from '../../api';
import { formatMoney, statementOffices } from './statementUtils';

type Props = {
  open: boolean
  statement: any
  onClose: () => void
  onSaved: () => void
}

const actionTypes = ['cash', 'bank', 'wallet', 'refund', 'compensation', 'cancellation', 'withdrawal'];

const toForm = (statement: any) => ({
  createdAt: statement?.createdAt ? new Date(statement.createdAt) : new Date(),
  amount: String(statement?.amount ?? ''),
  description: statement?.description || '',
  note: statement?.note || '',
  office: statement?.office || '',
  actionType: statement?.actionType || '',
});

const EditStatementDialog = ({ open, statement, onClose, onSaved }: Props) => {
  const { id } = useParams();
  const [form, setForm] = useState(toForm(statement));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(toForm(statement));
      setError('');
    }
  }, [open, statement]);

  const setField = (name: string, value: any) => setForm((prev) => ({ ...prev, [name]: value }));

  const isOutflow = statement?.calculationType === '-';
  const newAmount = Number(form.amount);
  const amountDelta = Number.isFinite(newAmount) ? newAmount - Number(statement?.amount || 0) : 0;
  // A bigger deposit adds to the wallet, a bigger payment takes from it
  const walletDelta = isOutflow ? -amountDelta : amountDelta;

  const save = async () => {
    if (!form.description.trim()) return setError('Description is required.');
    if (!Number.isFinite(newAmount) || newAmount <= 0) return setError('Amount must be greater than 0.');
    if (isNaN(new Date(form.createdAt).getTime())) return setError('Pick a valid date.');

    try {
      setIsSaving(true);
      setError('');
      await api.update(`user/${id}/statement/${statement._id}`, {
        ...form,
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
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.05rem' }}>Edit payment</DialogTitle>
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

          <FormControl size="small" fullWidth>
            <InputLabel id="edit-office-label">Office</InputLabel>
            <Select
              labelId="edit-office-label"
              label="Office"
              value={form.office}
              onChange={(event) => setField('office', event.target.value)}
            >
              <MenuItem value=""><em>No office</em></MenuItem>
              {statementOffices.map((office) => (
                <MenuItem key={office.value} value={office.value}>{office.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="edit-action-label">Action type</InputLabel>
            <Select
              labelId="edit-action-label"
              label="Action type"
              value={form.actionType}
              onChange={(event) => setField('actionType', event.target.value)}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {actionTypes.map((type) => (
                <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>

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
        <Button disabled={isSaving} variant="contained" disableElevation onClick={save}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditStatementDialog;
