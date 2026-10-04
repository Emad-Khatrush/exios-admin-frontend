import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { amountLabel, CancelDialog, today } from './shared';
import { cancelAction, useBulk } from './bulk';
import { AccountRef, Amount, Badge, DataTable, FilterBar, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';

// Custody (عهدة): money given to a staff member to spend for the company, settled by the expenses
// they pay from it (the Expenses screen, "from my custody") or returned. Loan (سلفة): money lent
// to them, taken back from their salary or returned. Kept apart, each in USD per employee.
type Kind = 'custody' | 'loan';
const KIND_TEXT: Record<Kind, { title: string; one: string; hint: string }> = {
  custody: { title: 'العهد', one: 'عهدة', hint: 'مبلغ يصرفه الموظف على مصاريف الشركة (من شاشة المصاريف ← «من عهدتي») ويُرجع الباقي.' },
  loan: { title: 'السلف', one: 'سلفة', hint: 'مبلغ مُقرض للموظف، يُخصم من راتبه أو يرجعه.' },
};
const MOVEMENT_TEXT: Record<string, { label: string; tone: 'ok' | 'warn' | 'info' | 'muted' | 'danger' }> = {
  given: { label: 'تسليم', tone: 'info' }, spent: { label: 'مصروف', tone: 'warn' }, returned: { label: 'إرجاع', tone: 'ok' },
  deducted: { label: 'خصم من الراتب', tone: 'ok' }, canceled: { label: 'إلغاء', tone: 'muted' }, other: { label: 'أخرى', tone: 'muted' },
};

const Employees = () => {
  const { accounts, offices } = useAccountingData();
  const [employees, setEmployees] = useState<any[]>([]);
  const [accountIds, setAccountIds] = useState<Record<Kind, string | null>>({ custody: null, loan: null });
  const [salaries, setSalaries] = useState<any[]>([]);
  const [move, setMove] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [salary, setSalary] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', onlyHolding: false, salaryMonth: '', salaryEmployee: '' });
  const key = useRef(newKey());

  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);

  const load = async () => {
    const [e, s] = await Promise.all([acc.get('employees'), acc.get('salaries')]);
    setEmployees(e.data.results);
    setAccountIds({ custody: e.data.custodyAccountId, loan: e.data.loanAccountId });
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

  const openReport = async (employee: any, kind: Kind) => {
    setReport({ employee, kind, data: null });
    try {
      const res = await acc.get(`employees/${employee._id}/movements`, { kind });
      setReport({ employee, kind, data: res.data });
    } catch (err) {
      setReport(null);
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const salaryBulk = useBulk<any>({
    rows: salaries, rowKey: (row) => row._id, rowLabel: (row) => row.number, onDone: load,
    actions: [cancelAction('AccountingSalaryPayment', 'إلغاء الرواتب', 'خصم السلفة يعود إلى سلفة الموظف.')],
  });

  const salaryCash = salary && cashAccounts.find((a) => a._id === salary.paidFromAccountId);
  const moveCash = move && cashAccounts.find((a) => a._id === move.cashId);
  const name = (row: any) => `${row.firstName || ''} ${row.lastName || ''}`.trim();
  const visible = (kind: Kind) => employees.filter((row) => (!filters.onlyHolding || row[kind] !== 0)
    && (!filters.search || name(row).toLowerCase().includes(filters.search.toLowerCase()) || String(row.customerId || '').toLowerCase().includes(filters.search.toLowerCase())));
  const shownSalaries = salaries.filter((row) => (!filters.salaryMonth || row.month === filters.salaryMonth) && (!filters.salaryEmployee || String(row.employeeId?._id) === filters.salaryEmployee));
  const total = (kind: Kind) => employees.reduce((sum, row) => sum + (row[kind] || 0), 0);

  const section = (kind: Kind) => (
    <Panel flush title={<>{KIND_TEXT[kind].title} <Sub>الإجمالي <Money value={total(kind)} /></Sub></>} subtitle={KIND_TEXT[kind].hint}>
      <DataTable
        dense loading={isLoading} rows={visible(kind)} rowKey={(row: any) => row._id}
        empty={{ title: filters.onlyHolding ? `لا أحد عنده ${KIND_TEXT[kind].one}` : 'لا يوجد موظفون' }}
        columns={[
          { key: 'name', header: 'الموظف', sortValue: (row: any) => row.firstName, render: (row: any) => <>{name(row)}{row.customerId && <Sub><Ltr>{row.customerId}</Ltr></Sub>}</> },
          { key: 'balance', header: kind === 'custody' ? 'في عهدته' : 'عليه سلفة', numeric: true, sortValue: (row: any) => row[kind], render: (row: any) => <Money value={row[kind]} strong={row[kind] !== 0} hideZero /> },
          {
            key: 'actions', header: '', align: 'end', render: (row: any) => (
              <span className="d-inline-flex gap-1 flex-wrap justify-content-end">
                <Button size="small" onClick={() => openReport(row, kind)}>التقرير</Button>
                <Button size="small" disabled={!accountIds[kind]} onClick={() => setMove({ employee: row, kind, direction: 'give', day: today(), cashId: '', amount: '', usd: '' })}>تسليم {KIND_TEXT[kind].one}</Button>
                <Button size="small" disabled={row[kind] <= 0} onClick={() => setMove({ employee: row, kind, direction: 'return', day: today(), cashId: '', amount: '', usd: '' })}>إرجاع</Button>
                {kind === 'loan' && <Button size="small" variant="outlined" onClick={() => setSalary({ employee: row, month: today().slice(0, 7), day: today(), office: '', paidFromAccountId: '', grossAmount: '', advanceDeduction: '', rate: '' })}>صرف راتب</Button>}
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );

  return (
    <>
      <PageHeader title="الموظفون والرواتب" subtitle="العهدة تُصرف على مصاريف الشركة أو تُرجع. السلفة تُخصم من الراتب أو تُرجع. كل منهما محفوظ بالدولار لكل موظف." />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}

      <FilterBar>
        <TextField size="small" placeholder="بحث باسم الموظف أو رمزه" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <TextField size="small" select label="عرض" value={filters.onlyHolding ? 'holding' : 'all'} onChange={(e) => setFilters({ ...filters, onlyHolding: e.target.value === 'holding' })} style={{ minWidth: 170 }}>
          <MenuItem value="all">كل الموظفين</MenuItem>
          <MenuItem value="holding">من عنده رصيد فقط</MenuItem>
        </TextField>
      </FilterBar>

      <div className="acc-grid-2">
        {section('custody')}
        {section('loan')}
      </div>

      <Panel flush title="الرواتب المصروفة">
        <div className="px-3">
          <FilterBar>
            <TextField size="small" type="month" label="الشهر" InputLabelProps={{ shrink: true }} value={filters.salaryMonth} onChange={(e) => setFilters({ ...filters, salaryMonth: e.target.value })} />
            <TextField size="small" select label="الموظف" value={filters.salaryEmployee} onChange={(e) => setFilters({ ...filters, salaryEmployee: e.target.value })} style={{ minWidth: 180 }}>
              <MenuItem value="">الكل</MenuItem>
              {employees.map((row) => <MenuItem key={row._id} value={row._id}>{name(row)}</MenuItem>)}
            </TextField>
          </FilterBar>
        </div>
        {salaryBulk.bar}
        <DataTable
          selection={salaryBulk.selection}
          loading={isLoading}
          rows={shownSalaries}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا رواتب' }}
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

      <Dialog open={!!move} onClose={() => setMove(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{move?.direction === 'give' ? `تسليم ${KIND_TEXT[move?.kind as Kind]?.one} إلى` : `إرجاع ${KIND_TEXT[move?.kind as Kind]?.one} من`} {move?.employee.firstName}</DialogTitle>
        {move && (
          <DialogContent>
            <p className="acc-muted">{move.direction === 'give' ? KIND_TEXT[move.kind as Kind].hint : <>الرصيد الحالي <Money value={move.employee[move.kind]} /></>}</p>
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={move.day} onChange={(e) => setMove({ ...move, day: e.target.value })} className="mt-2" />
            <TextField select label={move.direction === 'give' ? 'دُفع من' : 'أُرجع إلى'} value={move.cashId} onChange={(e) => setMove({ ...move, cashId: e.target.value })} fullWidth className="mt-3">
              {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label={amountLabel(moveCash?.currency)} value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} fullWidth className="mt-3" />
            {move.direction === 'return' && (moveCash?.currency || 'USD') !== 'USD' && (
              <TextField type="number" label="يُخصم من الرصيد (بالدولار)" value={move.usd} onChange={(e) => setMove({ ...move, usd: e.target.value })} fullWidth className="mt-3"
                helperText="الرصيد محفوظ بالدولار؛ الفرق يُسجَّل ربح/خسارة صرف" />
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setMove(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!move?.cashId || !(Number(move?.amount) > 0) || !accountIds[move?.kind as Kind]} onClick={() => {
            const give = move.direction === 'give';
            const holder = accountIds[move.kind as Kind] as string;
            // Returned into a non-USD box: the balance (kept in USD) loses the typed USD amount
            const usdOut = !give && Number(move.usd) > 0 ? Number(move.usd) : Number(move.amount);
            const one = KIND_TEXT[move.kind as Kind].one;
            submit('transfers', {
              day: move.day, employeeId: move.employee._id,
              fromAccountId: give ? move.cashId : holder, toAccountId: give ? holder : move.cashId,
              fromAmount: give ? Number(move.amount) : usdOut, toAmount: Number(move.amount),
              note: give ? `${one} ${move.employee.firstName}` : `إرجاع ${one} ${move.employee.firstName}`,
            }, () => setMove(null));
          }}>ترحيل</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!report} onClose={() => setReport(null)} maxWidth="md" fullWidth>
        <DialogTitle>تقرير {KIND_TEXT[report?.kind as Kind]?.one} {report && name(report.employee)}</DialogTitle>
        <DialogContent>
          {report && !report.data && <p className="acc-muted">جارٍ التحميل…</p>}
          {report?.data && (
            <>
              <div className="acc-stats">
                <div className="acc-stat"><div className="acc-stat__label">سُلِّم</div><div className="acc-stat__value"><Money value={report.data.given} /></div></div>
                <div className="acc-stat"><div className="acc-stat__label">{report.kind === 'custody' ? 'صُرف أو أُرجع' : 'خُصم أو أُرجع'}</div><div className="acc-stat__value"><Money value={report.data.used} /></div></div>
                <div className="acc-stat acc-stat--accent"><div className="acc-stat__label">الرصيد</div><div className="acc-stat__value"><Money value={report.data.balance} /></div></div>
              </div>
              <DataTable
                dense rows={report.data.movements} rowKey={(row: any) => String(row.entryId)}
                rowTone={(row: any) => (row.canceled ? 'canceled' : undefined)}
                empty={{ title: 'لا حركات' }}
                columns={[
                  { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
                  { key: 'kind', header: 'النوع', render: (row: any) => <Badge tone={MOVEMENT_TEXT[row.kind]?.tone || 'muted'}>{MOVEMENT_TEXT[row.kind]?.label || row.kind}</Badge> },
                  { key: 'description', header: 'البيان', render: (row: any) => row.description },
                  { key: 'usd', header: 'المبلغ', numeric: true, render: (row: any) => <Money value={row.usd} /> },
                ]}
              />
            </>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setReport(null)}>إغلاق</Button></DialogActions>
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
              helperText={<>عليه سلفة <Money value={salary.employee.loan} /> (العهدة لا تُخصم من الراتب)</>} />
            {salaryCash?.currency && salaryCash.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر تاريخ العملية)" value={salary.rate} onChange={(e) => setSalary({ ...salary, rate: e.target.value })} fullWidth className="mt-3" />}
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
