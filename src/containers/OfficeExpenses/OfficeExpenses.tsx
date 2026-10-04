import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Snackbar, TextField } from '@mui/material';
import moment from 'moment';
import { Paperclip, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { errorText, newKey, sys, todayLibya } from '../Accounting/accountingApi';
import './OfficeExpenses.scss';

// The office Expenses screen (spec 19.1). A staff member records what their office paid: the
// type, the amount in one of the office's cash currencies, the day and an optional receipt.
// Saving posts it to accounting (the expense against the office's cash box). Each person sees
// only what they entered, with no totals; they can change or delete an entry the same day.
// Later corrections are made by the accountant from accounting.

type Expense = {
  _id: string;
  number: string;
  day: string;
  type: string;
  expenseTypeId: string;
  amount: number;
  currency: string;
  note: string;
  attachments: { path: string; filename: string; fileType?: string }[];
  editable: boolean;
  // Paid from the office cash box, or from the custody the staff member holds
  paidFrom?: 'box' | 'custody';
};

type Options = {
  office: string | null;
  officeName: string | null;
  anyOffice: boolean;
  offices: { code: string; name: string }[];
  types: { _id: string; name: string }[];
  currencies: string[];
  // The custody this staff member holds, in USD cents: expenses may be paid from it
  custody?: number;
};

const blank = (currency = '') => ({ expenseTypeId: '', amount: '', currency, day: todayLibya(), note: '', payFrom: 'box' as 'box' | 'custody' });

const formatAmount = (value: number) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

const OfficeExpenses = () => {
  const [options, setOptions] = useState<Options | null>(null);
  const [office, setOffice] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank());
  const [receipt, setReceipt] = useState<File | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const key = useRef(newKey());
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadOptions = async (requestedOffice?: string) => {
    const res = await sys.get('office-expenses/options', requestedOffice ? { office: requestedOffice } : undefined);
    setOptions(res.data);
    setOffice(res.data.office || '');
    setForm((current) => ({ ...current, currency: res.data.currencies.includes(current.currency) ? current.currency : (res.data.currencies[0] || '') }));
  };

  const loadExpenses = async () => {
    const res = await sys.get('office-expenses');
    setExpenses(res.data.results || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadOptions(), loadExpenses()]);
      } catch (err) {
        setError(errorText(err, 'Could not load the expenses. Refresh the page.'));
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeOffice = async (code: string) => {
    setOffice(code);
    try {
      await loadOptions(code);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const reset = () => {
    setForm(blank(options?.currencies[0] || ''));
    setReceipt(null);
    setEditing(null);
    setError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const startEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({ expenseTypeId: expense.expenseTypeId, amount: String(expense.amount), currency: expense.currency, day: expense.day, note: expense.note, payFrom: expense.paidFrom === 'custody' ? 'custody' : 'box' });
    setReceipt(null);
    setError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const canSave = !!form.expenseTypeId && Number(form.amount) > 0 && !!form.currency && !!form.day && !saving;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) {
      setError('Choose the type, the amount and the currency.');
      return;
    }
    const body = new FormData();
    body.append('expenseTypeId', form.expenseTypeId);
    body.append('amount', String(Number(form.amount)));
    body.append('currency', form.currency);
    body.append('day', form.day);
    body.append('note', form.note.trim());
    if (form.payFrom === 'custody') body.append('payFrom', 'custody');
    if (options?.anyOffice && office) body.append('office', office);
    if (!editing) body.append('idempotencyKey', key.current);
    if (receipt) body.append('files', receipt);
    try {
      setSaving(true);
      setError('');
      if (editing) await sys.form(`office-expenses/${editing._id}`, 'PUT', body);
      else await sys.form('office-expenses', 'POST', body);
      key.current = newKey();
      setToast(editing ? 'Expense updated' : 'Expense saved');
      reset();
      await loadExpenses();
    } catch (err) {
      setError(errorText(err, 'Could not save the expense. Try again.'));
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await sys.delete(`office-expenses/${deleteTarget._id}`);
      if (editing?._id === deleteTarget._id) reset();
      setDeleteTarget(null);
      setToast('Expense deleted');
      await loadExpenses();
    } catch (err) {
      setDeleteTarget(null);
      setError(errorText(err, 'Could not delete the expense.'));
    }
    setDeleting(false);
  };

  const grouped = useMemo(() => {
    const days = new Map<string, Expense[]>();
    expenses.forEach((expense) => {
      if (!days.has(expense.day)) days.set(expense.day, []);
      days.get(expense.day)!.push(expense);
    });
    return Array.from(days.entries());
  }, [expenses]);

  if (loading) {
    return <div className="oe-page"><div className="oe-loading"><CircularProgress size={28} /></div></div>;
  }

  const noOffice = !options?.office && !options?.anyOffice;
  const today = todayLibya();

  return (
    <div className="oe-page">
      <header className="oe-header">
        <div>
          <h1>Expenses</h1>
          <p>What your office paid out of its cash box. It goes straight into accounting.</p>
        </div>
        {options?.anyOffice ? (
          <TextField select size="small" label="Office" value={office} onChange={(e) => changeOffice(e.target.value)} className="oe-office-select">
            {options.offices.map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
          </TextField>
        ) : options?.officeName && <span className="oe-office-chip">{options.officeName} office</span>}
      </header>

      {noOffice ? (
        <Alert severity="warning">Your office is not set yet. Ask the owner to set it (Accounting → Access → Staff offices).</Alert>
      ) : (
        <div className="oe-layout">
          <form ref={formRef} className={`oe-card oe-form${editing ? ' is-editing' : ''}`} onSubmit={save} noValidate>
            <div className="oe-card__head">
              <h2>{editing ? 'Change expense' : 'New expense'}</h2>
              {editing && <button type="button" className="oe-link" onClick={reset}><X size={14} /> Cancel change</button>}
            </div>

            <TextField select fullWidth size="small" label="Type" value={form.expenseTypeId} onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value })}>
              {(options?.types || []).map((type) => <MenuItem key={type._id} value={type._id}>{type.name}</MenuItem>)}
            </TextField>

            {((options?.custody || 0) > 0 || form.payFrom === 'custody') && (
              <TextField select fullWidth size="small" label="Paid from" value={form.payFrom} disabled={!!editing} onChange={(e) => setForm({ ...form, payFrom: e.target.value as 'box' | 'custody' })}
                helperText={form.payFrom === 'custody' ? "Taken from the custody you hold. Another currency is counted in dollars at the day's rate." : undefined}>
                <MenuItem value="box">Office cash box</MenuItem>
                <MenuItem value="custody">My custody (${formatAmount((options?.custody || 0) / 100)})</MenuItem>
              </TextField>
            )}

            <div className="oe-row">
              <TextField
                fullWidth size="small" type="number" label="Amount" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                onWheel={(event: any) => event.target.blur()}
                inputProps={{ inputMode: 'decimal', step: 'any', min: 0 }}
              />
              <TextField select size="small" label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="oe-currency">
                {(options?.currencies || []).concat(form.payFrom === 'custody' && !(options?.currencies || []).includes('USD') ? ['USD'] : []).map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
              </TextField>
            </div>

            <TextField fullWidth size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.day} inputProps={{ max: today }} onChange={(e) => setForm({ ...form, day: e.target.value })} />

            <TextField fullWidth size="small" label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} multiline minRows={2} inputProps={{ dir: 'auto' }} />

            <div className="oe-receipt">
              <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
              <button type="button" className="oe-btn is-ghost" onClick={() => fileInput.current?.click()}>
                <Paperclip size={15} /> {receipt ? 'Change receipt' : editing?.attachments?.length ? 'Replace receipt' : 'Add receipt (optional)'}
              </button>
              {receipt && <span className="oe-file">{receipt.name}</span>}
            </div>

            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            <button type="submit" className="oe-btn is-primary" disabled={!canSave}>
              {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <>{!editing && <Plus size={16} />}{editing ? 'Save change' : 'Save expense'}</>}
            </button>
          </form>

          <section className="oe-card oe-list" aria-labelledby="oe-mine">
            <div className="oe-card__head"><h2 id="oe-mine">Your expenses</h2></div>
            {expenses.length === 0 ? (
              <div className="oe-empty">
                <Receipt size={28} strokeWidth={1.5} />
                <strong>Nothing recorded yet</strong>
                <p>Expenses you save appear here.</p>
              </div>
            ) : grouped.map(([day, items]) => (
              <div key={day} className="oe-day">
                <div className="oe-day__label">{day === today ? 'Today' : moment(day).format('dddd, D MMM YYYY')}</div>
                {items.map((expense: Expense) => (
                  <div key={expense._id} className={`oe-item${editing?._id === expense._id ? ' is-editing' : ''}`}>
                    <div className="oe-item__main">
                      <strong>{expense.type}{expense.paidFrom === 'custody' && <small className="oe-custody"> · from custody</small>}</strong>
                      {expense.note && <span dir="auto">{expense.note}</span>}
                    </div>
                    <div className="oe-item__amount">{formatAmount(expense.amount)} <small>{expense.currency}</small></div>
                    <div className="oe-item__actions">
                      {expense.attachments?.[0] && (
                        <a href={expense.attachments[0].path} target="_blank" rel="noreferrer" className="oe-icon" title="Receipt" aria-label="Open receipt"><Paperclip size={15} /></a>
                      )}
                      {expense.editable && (
                        <>
                          <button type="button" className="oe-icon" onClick={() => startEdit(expense)} title="Change" aria-label="Change expense"><Pencil size={15} /></button>
                          <button type="button" className="oe-icon is-danger" onClick={() => setDeleteTarget(expense)} title="Delete" aria-label="Delete expense"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <p className="oe-hint">You can change or delete an expense on the day you entered it. After that, ask the accountant.</p>
          </section>
        </div>
      )}

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this expense?</DialogTitle>
        <DialogContent sx={{ fontSize: '0.9rem', color: '#5b6673' }}>
          {deleteTarget?.type}, {deleteTarget && formatAmount(deleteTarget.amount)} {deleteTarget?.currency}. The money goes back to the office cash box in accounting.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button type="button" className="oe-btn is-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Keep it</button>
          <button type="button" className="oe-btn is-danger" onClick={remove} disabled={deleting}>{deleting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Delete'}</button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2500} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} onClose={() => setToast('')}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </div>
  );
};

export default OfficeExpenses;
