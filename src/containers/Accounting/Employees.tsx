import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { amountLabel, CancelDialog, today } from './shared';
import { cancelAction, useBulk } from './bulk';
import { AccountRef, Amount, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';

const Employees = () => {
  const navigate = useNavigate();
  const { accounts, offices } = useAccountingData();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [advance, setAdvance] = useState<any>(null);
  const [salary, setSalary] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const key = useRef(newKey());

  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);
  const advancesAccount = accounts.find((a) => a.requires?.includes('employee') && !a.isGroup);

  const load = async () => {
    const [e, s] = await Promise.all([acc.get('employees'), acc.get('salaries')]);
    setEmployees(e.data.results);
    setSalaries(s.data.results);
    setIsLoading(false);
  };
  useEffect(() => { load().catch(() => setIsLoading(false)); }, []);

  const submit = async (path: string, body: any, done: () => void) => {
    try {
      await acc.post(path, { ...body, idempotencyKey: key.current });
      key.current = newKey();
      setMessage({ type: 'success', text: 'تم الترحيل.' });
      done();
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const salaryBulk = useBulk<any>({
    rows: salaries, rowKey: (row) => row._id, rowLabel: (row) => row.number, onDone: load,
    actions: [cancelAction('AccountingSalaryPayment', 'إلغاء الرواتب', 'خصم السلفة يعود إلى عهدة الموظف.')],
  });

  const salaryCash = salary && cashAccounts.find((a) => a._id === salary.paidFromAccountId);
  const advanceCash = advance && cashAccounts.find((a) => a._id === advance.cashId);

  return (
    <>
      <PageHeader title="الموظفون والرواتب" subtitle="المبلغ المسلَّم لموظف (عهدة أو سلفة) يبقى على حسابه حتى يصرفه على فاتورة، أو يرجعه، أو يُخصم من راتبه." />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}

      <Panel flush title="العهد والسلف">
        <DataTable
          loading={isLoading}
          rows={employees}
          rowKey={(row: any) => row._id}
          empty={{ title: 'لا يوجد موظفون' }}
          columns={[
            { key: 'name', header: 'الموظف', sortValue: (row: any) => row.firstName, render: (row: any) => `${row.firstName} ${row.lastName}` },
            { key: 'advance', header: 'في عهدته', numeric: true, sortValue: (row: any) => row.advance, render: (row: any) => <Money value={row.advance} strong={row.advance !== 0} /> },
            {
              key: 'actions', header: '', align: 'end', render: (row: any) => (
                <span className="d-inline-flex gap-1 flex-wrap justify-content-end">
                  {advancesAccount && <Button size="small" onClick={() => navigate(`/accounting/entries?accountId=${advancesAccount._id}`)}>الحركات</Button>}
                  <Button size="small" onClick={() => setAdvance({ employee: row, direction: 'give', day: today(), cashId: '', amount: '', usd: '' })}>تسليم</Button>
                  <Button size="small" disabled={row.advance <= 0} onClick={() => setAdvance({ employee: row, direction: 'return', day: today(), cashId: '', amount: '', usd: '' })}>إرجاع</Button>
                  <Button size="small" variant="outlined" onClick={() => setSalary({ employee: row, month: today().slice(0, 7), day: today(), office: '', paidFromAccountId: '', grossAmount: '', advanceDeduction: '', rate: '' })}>صرف راتب</Button>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <Panel flush title="الرواتب المصروفة">
        {salaryBulk.bar}
        <DataTable
          selection={salaryBulk.selection}
          loading={isLoading}
          rows={salaries}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لم يُصرف أي راتب بعد' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'employee', header: 'الموظف', render: (row: any) => <>{row.employeeId?.firstName} {row.employeeId?.lastName}<Sub>شهر <Ltr>{row.month}</Ltr> · {OFFICE_LABELS[row.office] || row.office}</Sub></> },
            { key: 'gross', header: 'الإجمالي', numeric: true, render: (row: any) => <Amount value={row.grossAmount} currency={row.currency} /> },
            { key: 'deduction', header: 'خصم السلفة', numeric: true, hideOnMobile: true, render: (row: any) => (row.advanceDeduction ? <Amount value={row.advanceDeduction} currency={row.currency} /> : <span className="acc-muted">-</span>) },
            { key: 'from', header: 'من', hideOnMobile: true, render: (row: any) => <AccountRef code={row.paidFromAccountId?.code} name={row.paidFromAccountId?.name} /> },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>

      <Dialog open={!!advance} onClose={() => setAdvance(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{advance?.direction === 'give' ? 'تسليم عهدة / سلفة إلى' : 'مبلغ أرجعه'} {advance?.employee.firstName}</DialogTitle>
        {advance && (
          <DialogContent>
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={advance.day} onChange={(e) => setAdvance({ ...advance, day: e.target.value })} className="mt-2" />
            <TextField select label={advance.direction === 'give' ? 'دُفع من' : 'أُرجع إلى'} value={advance.cashId} onChange={(e) => setAdvance({ ...advance, cashId: e.target.value })} fullWidth className="mt-3">
              {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label={amountLabel(advanceCash?.currency)} value={advance.amount} onChange={(e) => setAdvance({ ...advance, amount: e.target.value })} fullWidth className="mt-3" />
            {advance.direction === 'return' && (advanceCash?.currency || 'USD') !== 'USD' && (
              <TextField type="number" label="يُخصم من العهدة (بالدولار)" value={advance.usd} onChange={(e) => setAdvance({ ...advance, usd: e.target.value })} fullWidth className="mt-3"
                helperText="العهد تُحفظ بالدولار؛ الفرق يُسجَّل ربح/خسارة صرف" />
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setAdvance(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!advance?.cashId || !(Number(advance?.amount) > 0) || !advancesAccount} onClick={() => {
            const give = advance.direction === 'give';
            // Returned into a non-USD box: the advance (kept in USD) loses the typed USD amount
            const usdOut = !give && Number(advance.usd) > 0 ? Number(advance.usd) : Number(advance.amount);
            submit('transfers', {
              day: advance.day, employeeId: advance.employee._id,
              fromAccountId: give ? advance.cashId : advancesAccount!._id, toAccountId: give ? advancesAccount!._id : advance.cashId,
              fromAmount: give ? Number(advance.amount) : usdOut, toAmount: Number(advance.amount),
              note: give ? `عهدة/سلفة ${advance.employee.firstName}` : `إرجاع عهدة ${advance.employee.firstName}`,
            }, () => setAdvance(null));
          }}>ترحيل</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!salary} onClose={() => setSalary(null)} maxWidth="xs" fullWidth>
        <DialogTitle>راتب {salary?.employee.firstName} {salary?.employee.lastName}</DialogTitle>
        {salary && (
          <DialogContent>
            <div className="d-flex gap-2 mt-2">
              <TextField type="month" label="الشهر" InputLabelProps={{ shrink: true }} value={salary.month} onChange={(e) => setSalary({ ...salary, month: e.target.value })} />
              <TextField type="date" label="تاريخ الصرف" InputLabelProps={{ shrink: true }} value={salary.day} onChange={(e) => setSalary({ ...salary, day: e.target.value })} />
            </div>
            <TextField select label="المكتب" value={salary.office} onChange={(e) => setSalary({ ...salary, office: e.target.value })} fullWidth className="mt-3">
              {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
            </TextField>
            <TextField select label="صُرف من" value={salary.paidFromAccountId} onChange={(e) => setSalary({ ...salary, paidFromAccountId: e.target.value })} fullWidth className="mt-3">
              {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label={`الراتب الإجمالي (${salaryCash?.currency || ''})`} value={salary.grossAmount} onChange={(e) => setSalary({ ...salary, grossAmount: e.target.value })} fullWidth className="mt-3" />
            <TextField type="number" label="خصم من السلفة" value={salary.advanceDeduction} onChange={(e) => setSalary({ ...salary, advanceDeduction: e.target.value })} fullWidth className="mt-3"
              helperText={<>في عهدته <Money value={salary.employee.advance} /></>} />
            {salaryCash?.currency && salaryCash.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر اليوم)" value={salary.rate} onChange={(e) => setSalary({ ...salary, rate: e.target.value })} fullWidth className="mt-3" />}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setSalary(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!salary?.office || !salary?.paidFromAccountId || !(Number(salary?.grossAmount) > 0)} onClick={() => submit('salaries', {
            employeeId: salary.employee._id, month: salary.month, day: salary.day, office: salary.office, paidFromAccountId: salary.paidFromAccountId,
            grossAmount: Number(salary.grossAmount), advanceDeduction: Number(salary.advanceDeduction) || 0, rate: Number(salary.rate) || undefined,
          }, () => setSalary(null))}>ترحيل</Button>
        </DialogActions>
      </Dialog>

      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingSalaryPayment" id={cancel._id} title={`الراتب ${cancel.number}`} />}
    </>
  );
};

export default Employees;
