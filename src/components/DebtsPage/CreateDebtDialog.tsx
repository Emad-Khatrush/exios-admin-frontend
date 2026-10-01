import { Alert, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import api from "../../api";
import { sys } from "../../containers/Accounting/accountingApi";
import { getErrorMessage } from "../../utils/errorHandler";

import './Debts.scss';

type Props = {
  setDialog: (state: any) => void
  orderId?: string
  customerId?: string
  debtType?: string
}

const CreateDebtDialog = (props: Props) => {
  const [form, setForm] = useState<any>({ debtType: props.debtType });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const hasOrder = !!(props.orderId || form.orderId?.trim());
  // A debt that only reminds of an order's own bill needs nothing more. Any other debt is money
  // that left the company: say where it came from (a cash box, a bank, or a partner who paid it
  // for us, like Aswaq), so accounting records it (spec 19.8)
  const needsSource = !hasOrder || form.debtType === 'general';
  const [sources, setSources] = useState<any[]>([]);
  useEffect(() => {
    if (!needsSource || !form.currency) return setSources([]);
    sys.get('acc/money-accounts', { currency: form.currency })
      .then((res: any) => setSources(res.data.results || []))
      .catch(() => setSources([]));
  }, [needsSource, form.currency]);

  const closeDialog = () => props.setDialog({ customComponentTag: undefined, isOpen: false });

  const onSubmit = async (event: any) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      setError(undefined);
      await api.post('balances', { ...form, sourceAccountId: needsSource ? form.sourceAccountId : undefined, balanceType: 'debt', orderId: props.orderId || form.orderId, customerId: props.customerId || form.customerId });
      window.location.reload();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Something went wrong')
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <DialogTitle>
        <span className="debt-dialog-title">
          <strong>New debt</strong>
          <span>Record money a customer owes the company.</span>
        </span>
      </DialogTitle>

      <DialogContent>
        {error &&
          <Alert severity="error" className="mb-3">{getErrorMessage(error as any)}</Alert>
        }

        <p className="debt-dialog-section">Customer</p>
        <div className="row g-3 mb-2">
          <div className='col-sm-6'>
            <TextField
              fullWidth
              name="orderId"
              label={'Order ID'}
              helperText={!props.orderId ? 'The debt follows this order\'s customer' : undefined}
              onChange={onChangeHandler}
              value={props.orderId}
              disabled={!!props.orderId}
              autoFocus={!props.orderId}
            />
          </div>

          <div className='col-sm-6'>
            <TextField
              fullWidth
              name="customerId"
              label={'Customer code'}
              // With an order the customer comes from the order, so the code is only a cross-check
              required={!hasOrder}
              helperText={!props.customerId ? (hasOrder ? 'Optional with an order' : 'Required without an order') : undefined}
              onChange={onChangeHandler}
              value={props.customerId}
              disabled={!!props.customerId}
            />
          </div>
        </div>

        <p className="debt-dialog-section">Debt</p>
        <div className="row g-3">
          <div className="col-sm-6 d-flex">
            <TextField
              fullWidth
              className='connect-field-right'
              name="amount"
              type={'number'}
              inputProps={{ inputMode: 'decimal', step: .01, min: 0 }}
              onWheel={(event: any) => event.target.blur()}
              required={true}
              label={'Amount'}
              onChange={onChangeHandler}
            />
            <FormControl style={{ minWidth: '100px' }} required>
              <InputLabel id="create-debt-currency">Currency</InputLabel>
              <Select
                className='connect-field-left'
                labelId="create-debt-currency"
                value={form.currency || ''}
                label={'Currency'}
                name="currency"
                onChange={onChangeHandler}
              >
                <MenuItem value={'USD'}>USD</MenuItem>
                <MenuItem value={'LYD'}>LYD</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="col-sm-6">
            <FormControl fullWidth required>
              <InputLabel id="create-debt-office">Office</InputLabel>
              <Select
                labelId="create-debt-office"
                value={form.createdOffice || ''}
                label={'Office'}
                name="createdOffice"
                onChange={onChangeHandler}
              >
                <MenuItem value={'tripoli'}>Tripoli office</MenuItem>
                <MenuItem value={'benghazi'}>Benghazi office</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="col-12">
            <FormControl fullWidth required>
              <InputLabel id="create-debt-type">اختار نوع الدين</InputLabel>
              <Select
                labelId="create-debt-type"
                value={form.debtType || ''}
                label={'اختار نوع الدين'}
                name="debtType"
                onChange={onChangeHandler}
                dir="rtl"
              >
                <MenuItem dir="rtl" value={'invoice'}>دين لاجل تسديد فاتورة شراء</MenuItem>
                <MenuItem dir="rtl" value={'receivedGoods'}>دين لاجل تسديد شحن</MenuItem>
                <MenuItem dir="rtl" value={'general'}>دين عام لا يتعلق بطلبية</MenuItem>
              </Select>
            </FormControl>
          </div>

          {needsSource && (
            <div className="col-12">
              <FormControl fullWidth required disabled={!form.currency}>
                <InputLabel id="create-debt-source">Money came from</InputLabel>
                <Select
                  labelId="create-debt-source"
                  value={form.sourceAccountId || ''}
                  label={'Money came from'}
                  name="sourceAccountId"
                  onChange={onChangeHandler}
                >
                  {sources.map((account) => (
                    <MenuItem key={account._id} value={account._id}>{account.name} · {account.kindLabel}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>{form.currency ? 'The cash box, bank or partner that paid this money for the customer.' : 'Choose the currency first.'}</FormHelperText>
              </FormControl>
            </div>
          )}

          <div className="col-12">
            <TextField
              fullWidth
              multiline
              minRows={3}
              name='notes'
              label='Notes'
              required
              inputProps={{ dir: 'auto' }}
              onChange={onChangeHandler}
            />
          </div>
        </div>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <button type="button" className="debts-btn is-ghost" disabled={isLoading} onClick={closeDialog}>Cancel</button>
        <button type="submit" className="debts-btn is-primary" disabled={isLoading}>
          {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Create debt'}
        </button>
      </DialogActions>
    </form>
  )
}

export default CreateDebtDialog;
