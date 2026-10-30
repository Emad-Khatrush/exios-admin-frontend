import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { amountLabel, CancelDialog, today } from './shared';
import { cancelAction, useBulk } from './bulk';
import { AccountRef, Amount, Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, StatusBadge, Sub } from './ui';
import { useReactToPrint } from 'react-to-print';
import { currentRound, HandoverReceipt, SettlementStatement } from './CustodyPapers';
import EmployeeDirectory from './EmployeeDirectory';
import { useAccountingAccess } from './useAccountingAccess';

// Custody (عهدة): money given to a staff member to spend for the company, settled by the expenses
// they pay from it (the Expenses screen, "from my custody") or returned. Loan (سلفة): money lent
// to them, taken back from their salary or returned. Kept apart, per employee, each in its own
// currency: what is given in dinars is settled in dinars, so no exchange difference appears.
type Kind = 'custody' | 'loan';
type Held = Record<string, number>;
const CURRENCIES = ['USD', 'LYD'];
const held = (value: Held | undefined, currency: string) => Number(value?.[currency] || 0);
const holds = (value: Held | undefined) => CURRENCIES.some((c) => Math.abs(held(value, c)) > 0.0001);
// "250 USD · 760 LYD", or a dash
const Balances = ({ value, strong }: { value?: Held; strong?: boolean }) => {
  const shown = CURRENCIES.filter((c) => Math.abs(held(value, c)) > 0.0001);
  if (!shown.length) return <span className="acc-muted">-</span>;
  return <span className={strong ? 'fw-semibold' : undefined}>{shown.map((c, i) => <span key={c}>{i > 0 && ' · '}<Amount value={held(value, c)} currency={c} /></span>)}</span>;
};
const KIND_TEXT: Record<Kind, { title: string; one: string; hint: string }> = {
  custody: { title: 'العهد', one: 'عهدة', hint: 'مبلغ يصرفه الموظف على مصاريف الشركة (من شاشة المصاريف ← «من عهدتي») ويُرجع الباقي.' },
  loan: { title: 'السلف', one: 'سلفة', hint: 'مبلغ مُقرض للموظف، يُخصم من راتبه أو يرجعه.' },
};
const MOVEMENT_TEXT: Record<string, { label: string; tone: 'ok' | 'warn' | 'info' | 'muted' | 'danger' }> = {
  given: { label: 'تسليم', tone: 'info' }, spent: { label: 'مصروف', tone: 'warn' }, returned: { label: 'إرجاع', tone: 'ok' },
  deducted: { label: 'خصم من الراتب', tone: 'ok' }, canceled: { label: 'إلغاء', tone: 'muted' }, other: { label: 'أخرى', tone: 'muted' },
};

const Employees = () => {
  const access = useAccountingAccess();
  const { accounts, offices, currencies } = useAccountingData();
  const [employees, setEmployees] = useState<any[]>([]);
  // The custody and loan account of each currency: { custody: { USD: id, LYD: id }, loan: ... }
  const [accountIds, setAccountIds] = useState<Record<Kind, Record<string, string>>>({ custody: {}, loan: {} });
  const [salaries, setSalaries] = useState<any[]>([]);
  const [move, setMove] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [salary, setSalary] = useState<any>(null);
  const [salaryPreview, setSalaryPreview] = useState<any>(null);
  const [salaryPreviewError, setSalaryPreviewError] = useState('');
  const [posting, setPosting] = useState(false);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', onlyHolding: false, salaryMonth: '', salaryEmployee: '' });
  const key = useRef(newKey());
  // The paper being printed: a handover receipt or a settlement (owner's request 2026-10-04)
  const [paper, setPaper] = useState<any>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const printPaper = useReactToPrint({ contentRef: paperRef, documentTitle: paper ? `${paper.type}-${paper.employee}` : 'custody', pageStyle: '@page { size: A4 portrait; margin: 0; } html, body { margin: 0; }' });
  // Printed once React has rendered the paper into the hidden container
  const [printRequested, setPrintRequested] = useState(false);
  useEffect(() => {
    if (!printRequested || !paper) return;
    printPaper?.();
    setPrintRequested(false);
  }, [printRequested, paper, printPaper]);

  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);

  const load = async () => {
    const [e, s] = await Promise.all([acc.get('employees', { includeArchived: true }), acc.get('salaries', { status: 'all', limit: 200 })]);
    setEmployees(e.data.results);
    setAccountIds({ custody: e.data.accounts?.custody || {}, loan: e.data.accounts?.loan || {} });
    setSalaries(s.data.results);
    setIsLoading(false);
  };
  useEffect(() => { load().catch(() => setIsLoading(false)); }, []);

  const submit = async (path: string, body: any, done: () => void) => {
    if (posting) return;
    setPosting(true);
    try {
      await acc.post(path, { ...body, idempotencyKey: key.current });
      key.current = newKey();
      setMessage({ type: 'success', text: 'تم الترحيل.' });
      done();
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally { setPosting(false); }
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
  const salaryEmployeeId = salary?.employee?._id;
  const salaryMonth = salary?.month;
  const salaryDay = salary?.day;
  const salaryRate = salary?.rate;
  const commissionPayment = salary?.paymentKind === 'commission';
  const salaryCurrency = salaryCash?.currency || (commissionPayment ? salary?.paymentCurrency : salary?.employee?.salaryCurrency) || 'USD';
  useEffect(() => {
    setSalaryPreview(null); setSalaryPreviewError('');
    if (!salaryEmployeeId || !salaryMonth) return;
    let stale = false;
    acc.get(`employees/${salaryEmployeeId}/salary-preview`, { month: salaryMonth, currency: salaryCurrency, day: salaryDay, rate: salaryRate || undefined, paymentKind: commissionPayment ? 'commission' : 'salary' })
      .then((r: any) => { if (!stale) setSalaryPreview(r.data); })
      .catch((e: any) => { if (!stale) setSalaryPreviewError(errorText(e)); });
    return () => { stale = true; };
  }, [salaryEmployeeId, salaryMonth, salaryCurrency, salaryDay, salaryRate, commissionPayment]);
  const salaryDecimals = currencies.find(c => c.code === salaryCurrency)?.decimals ?? 2;
  const salaryGross = Number((commissionPayment ? Number(salary?.commissionAmount === '' ? salaryPreview?.availableAmount || 0 : salary?.commissionAmount || 0) : Number(salary?.baseSalary || 0) - Number(salaryPreview?.salaryDeduction || 0)).toFixed(salaryDecimals));
  const salaryNet = Number((salaryGross - (commissionPayment ? 0 : Number(salary?.advanceDeduction || 0))).toFixed(salaryDecimals));
  const openSalary = (employee: any, paymentKind: 'salary' | 'commission' = 'salary') => {
    setMessage(null);
    key.current = newKey();
    setSalaryPreview(null); setSalaryPreviewError('');
    const paymentCurrency = paymentKind === 'commission' ? 'USD' : employee.salaryCurrency || 'USD';
    setSalary({ employee, paymentKind, paymentCurrency, commissionAmount: '', closeCommissions: false, commissionCloseReason: 'تسوية نهائية للعمولة وإلغاء المتبقي', month: today().slice(0, 7), day: today(), office: employee.office || '',
      paidFromAccountId: cashAccounts.find(a => (a.currency || 'USD') === paymentCurrency)?._id || '', baseSalary: employee.baseSalary || '', advanceDeduction: '', rate: '' });
  };
  const moveCash = move && cashAccounts.find((a) => a._id === move.cashId);
  const name = (row: any) => `${row.firstName || ''} ${row.lastName || ''}`.trim();
  const visible = (kind: Kind) => employees.filter((row) => row.hasLogin && row.isActive !== false && (!filters.onlyHolding || holds(row[kind]))
    && (!filters.search || name(row).toLowerCase().includes(filters.search.toLowerCase()) || String(row.customerId || '').toLowerCase().includes(filters.search.toLowerCase())));
  const shownSalaries = salaries.filter((row) => (!filters.salaryMonth || row.month === filters.salaryMonth) && (!filters.salaryEmployee || String(row.employeeId?._id) === filters.salaryEmployee));
  const total = (kind: Kind) => Object.fromEntries(CURRENCIES.map((c) => [c, employees.reduce((sum, row) => sum + held(row[kind], c), 0)]));
  // The boxes money can go out of or back into: those in a currency that has a custody/loan account;
  // a return only into a currency the employee holds
  const moveBoxes = (kind: Kind, employee: any, direction: string) => cashAccounts.filter((a) => accountIds[kind][a.currency || 'USD']
    && (direction === 'give' || held(employee[kind], a.currency || 'USD') > 0));

  const section = (kind: Kind) => (
    <Panel flush title={<>{KIND_TEXT[kind].title} <Sub>الإجمالي <Balances value={total(kind)} /></Sub></>} subtitle={KIND_TEXT[kind].hint}>
      <DataTable
        dense loading={isLoading} rows={visible(kind)} rowKey={(row: any) => row._id}
        empty={{ title: filters.onlyHolding ? `لا أحد عنده ${KIND_TEXT[kind].one}` : 'لا يوجد موظفون' }}
        columns={[
          { key: 'name', header: 'الموظف', sortValue: (row: any) => row.firstName, render: (row: any) => <>{name(row)}{row.customerId && <Sub><Ltr>{row.customerId}</Ltr></Sub>}</> },
          { key: 'balance', header: kind === 'custody' ? 'في عهدته' : 'عليه سلفة', numeric: true, sortValue: (row: any) => held(row[kind], 'USD') * 10 + held(row[kind], 'LYD'), render: (row: any) => <Balances value={row[kind]} strong /> },
          {
            key: 'actions', header: '', align: 'end', render: (row: any) => (
              <span className="d-inline-flex gap-1 flex-wrap justify-content-end">
                <Button size="small" onClick={() => openReport(row, kind)}>التقرير</Button>
                <Button size="small" disabled={!Object.keys(accountIds[kind]).length} onClick={() => setMove({ employee: row, kind, direction: 'give', day: today(), cashId: '', amount: '' })}>تسليم {KIND_TEXT[kind].one}</Button>
                <Button size="small" disabled={!CURRENCIES.some((c) => held(row[kind], c) > 0)} onClick={() => setMove({ employee: row, kind, direction: 'return', day: today(), cashId: '', amount: '' })}>إرجاع</Button>
                {kind === 'loan' && access.can('payroll') && <Button size="small" variant="outlined" onClick={() => openSalary(row)}>صرف راتب</Button>}
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );

  return (
    <>
      <PageHeader title="الموظفون والرواتب" subtitle="العهدة تُصرف على مصاريف الشركة أو تُرجع. السلفة تُخصم من الراتب أو تُرجع. كل منهما محفوظ لكل موظف بعملته: ما أُعطي بالدينار يُقفل بالدينار، بلا فرق صرف." actions={<Open to="/accounting/financial-operations?kind=salary_accrual">مستحقات الرواتب والعمولات</Open>} />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      {access.can('payroll') && <EmployeeDirectory employees={employees} onReload={load} onPay={openSalary} />}

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

      <Panel flush title="الرواتب والعمولات المصروفة">
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
          empty={{ title: 'لا دفعات رواتب أو عمولات' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'employee', header: 'الموظف', render: (row: any) => <>{row.employeeName || `${row.employeeId?.firstName || ''} ${row.employeeId?.lastName || ''}`}<Sub>شهر <Ltr>{row.month}</Ltr> · {OFFICE_LABELS[row.office] || row.office}</Sub></> },
            { key: 'kind', header: 'نوع الصرف', render: (row: any) => <>{row.paymentKind === 'commission' ? 'عمولة' : row.commissionAmount > 0 ? 'راتب وعمولات (سابق)' : 'راتب أساسي'}{row.closeCommissions && <Sub>دفعة نهائية · إقفال المتبقي</Sub>}</> },
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
            {message?.type === 'error' && <Alert severity="error">{message.text}</Alert>}
            <p className="acc-muted">{move.direction === 'give' ? KIND_TEXT[move.kind as Kind].hint : <>الرصيد الحالي <Balances value={move.employee[move.kind]} /></>}</p>
            <p className="acc-muted">يُعطى ويُرجع بنفس العملة: الدولار من خزينة دولار والدينار من خزينة دينار.</p>
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={move.day} onChange={(e) => setMove({ ...move, day: e.target.value })} className="mt-2" />
            <TextField select label={move.direction === 'give' ? 'دُفع من' : 'أُرجع إلى'} value={move.cashId} onChange={(e) => setMove({ ...move, cashId: e.target.value })} fullWidth className="mt-3">
              {moveBoxes(move.kind, move.employee, move.direction).map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label={amountLabel(moveCash?.currency)} value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} fullWidth className="mt-3"
              helperText={move.direction === 'return' && moveCash ? <>عليه <Amount value={held(move.employee[move.kind], moveCash.currency || 'USD')} currency={moveCash.currency || 'USD'} /></> : undefined} />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setMove(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!moveCash || !(Number(move?.amount) > 0)} onClick={() => {
            const give = move.direction === 'give';
            // The employee's account in the box's currency: the same amount both ways
            const holder = accountIds[move.kind as Kind][moveCash.currency || 'USD'];
            const one = KIND_TEXT[move.kind as Kind].one;
            submit('transfers', {
              day: move.day, employeeId: move.employee._id,
              fromAccountId: give ? move.cashId : holder, toAccountId: give ? holder : move.cashId,
              fromAmount: Number(move.amount), toAmount: Number(move.amount),
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
                <div className="acc-stat"><div className="acc-stat__label">سُلِّم</div><div className="acc-stat__value"><Balances value={report.data.given} /></div></div>
                <div className="acc-stat"><div className="acc-stat__label">{report.kind === 'custody' ? 'صُرف أو أُرجع' : 'خُصم أو أُرجع'}</div><div className="acc-stat__value"><Balances value={report.data.used} /></div></div>
                <div className="acc-stat acc-stat--accent"><div className="acc-stat__label">الرصيد</div><div className="acc-stat__value"><Balances value={report.data.balance} /></div></div>
              </div>
              <div className="d-flex gap-2 flex-wrap my-2">
                {CURRENCIES.filter((c) => currentRound(report.data.movements, c).length > 0).map((c) => {
                  const closed = Math.abs(held(report.data.balance, c)) < 0.005;
                  return (
                    <Button key={c} size="small" variant="outlined" onClick={() => { setPrintRequested(true); setPaper({ type: 'settlement', kind: report.kind, employee: name(report.employee), currency: c, rows: currentRound(report.data.movements, c) }); }}>
                      {closed ? 'طباعة تسوية وإقفال' : 'طباعة كشف'} {KIND_TEXT[report.kind as Kind].one} {c}
                    </Button>
                  );
                })}
              </div>
              <DataTable
                dense rows={report.data.movements} rowKey={(row: any) => `${row.entryId}-${row.currency}`}
                rowTone={(row: any) => (row.canceled ? 'canceled' : undefined)}
                empty={{ title: 'لا حركات' }}
                columns={[
                  { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
                  { key: 'kind', header: 'النوع', render: (row: any) => <Badge tone={MOVEMENT_TEXT[row.kind]?.tone || 'muted'}>{MOVEMENT_TEXT[row.kind]?.label || row.kind}</Badge> },
                  { key: 'description', header: 'البيان', render: (row: any) => <>{row.detail || row.description}{row.reference && <Sub><Ltr>{row.reference}</Ltr>{row.receipts ? ` · ${row.receipts} إيصال` : ''}</Sub>}</> },
                  { key: 'cash', header: 'من/إلى الخزينة', numeric: true, render: (row: any) => (row.cash ? <><Amount value={row.cash.amount} currency={row.cash.currency} /><Sub>{row.cash.name}</Sub></> : <span className="acc-muted">-</span>) },
                  { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <><Amount value={row.amount} currency={row.currency} />{row.currency !== 'USD' && <Sub><Money value={row.usd} /></Sub>}</> },
                  { key: 'print', header: '', align: 'end', render: (row: any) => (row.kind === 'given' && !row.canceled
                    ? <Button size="small" onClick={() => { setPrintRequested(true); setPaper({ type: 'receipt', kind: report.kind, employee: name(report.employee), movement: row }); }}>إيصال التسليم</Button> : null) },
                ]}
              />
            </>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setReport(null)}>إغلاق</Button></DialogActions>
      </Dialog>

      {/* Rendered out of sight for printing only */}
      <div style={{ display: 'none' }}>
        <div ref={paperRef}>
          {paper?.type === 'receipt' && <HandoverReceipt kind={paper.kind} employee={paper.employee} movement={paper.movement} />}
          {paper?.type === 'settlement' && <SettlementStatement kind={paper.kind} employee={paper.employee} currency={paper.currency} rows={paper.rows} />}
        </div>
      </div>

      <Dialog open={!!salary} onClose={() => !posting && setSalary(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{commissionPayment ? 'صرف عمولة' : 'صرف الراتب الأساسي'} · {salary?.employee.firstName} {salary?.employee.lastName}</DialogTitle>
        {salary && (
          <DialogContent>
            {message?.type === 'error' && <Alert severity="error">{message.text}</Alert>}
            {salaryPreviewError && <Alert severity="error">{salaryPreviewError}</Alert>}
            {!commissionPayment && salaryCash && salaryCurrency !== salary.employee.salaryCurrency && <Alert severity="warning">اختر خزينة بعملة الراتب: {salary.employee.salaryCurrency}.</Alert>}
            <div className="d-flex gap-2 mt-2">
              <TextField type="month" label="الشهر" InputLabelProps={{ shrink: true }} value={salary.month} onChange={(e) => setSalary({ ...salary, month: e.target.value })} />
              <TextField type="date" label="تاريخ الصرف" InputLabelProps={{ shrink: true }} value={salary.day} onChange={(e) => setSalary({ ...salary, day: e.target.value })} />
            </div>
            <TextField select label="المكتب" value={salary.office} onChange={(e) => setSalary({ ...salary, office: e.target.value })} fullWidth className="mt-3">
              {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
            </TextField>
            {commissionPayment && <TextField select label="عملة صرف العمولة" value={salary.paymentCurrency} fullWidth className="mt-3"
              onChange={(e) => setSalary({ ...salary, paymentCurrency: e.target.value, commissionAmount: '', rate: '', paidFromAccountId: cashAccounts.find(a => (a.currency || 'USD') === e.target.value)?._id || '' })}>
              <MenuItem value="USD">دولار · USD</MenuItem><MenuItem value="LYD">دينار ليبي · LYD</MenuItem>
            </TextField>}
            <TextField select label="صُرف من" value={salary.paidFromAccountId} onChange={(e) => setSalary({ ...salary, paidFromAccountId: e.target.value })} fullWidth className="mt-3">
              {cashAccounts.filter(a => !commissionPayment || (a.currency || 'USD') === salary.paymentCurrency).map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            {commissionPayment ? <>
              <TextField type="number" label={`مبلغ العمولة المصروف (${salaryCurrency})`} value={salary.commissionAmount} placeholder={String(salaryPreview?.availableAmount || 0)}
                onChange={(e) => setSalary({ ...salary, commissionAmount: e.target.value })} fullWidth className="mt-3"
                inputProps={{ min: 0, step: 'any', max: salaryPreview?.availableAmount }} helperText="اتركه فارغًا لصرف كامل المتاح، أو أدخل دفعة جزئية." />
              {salaryPreview && <Alert severity="info" className="mt-3">المتاح حتى تاريخ الصرف: {salaryPreview.availableAmount} {salaryCurrency}. سيُصرف: {salaryNet} {salaryCurrency}. المتبقي: {Number((salaryPreview.availableAmount - salaryNet).toFixed(salaryDecimals))} {salaryCurrency}. لصرف العملة الأخرى، سجّل دفعة مستقلة. تُحوَّل العمولات المختلفة بسعر الصرف المسجّل، مع حفظ قيمتها الأصلية.</Alert>}
              {salaryPreview?.adjustments?.filter((row: any) => row.currency !== salaryCurrency).map((row: any) => <div key={row._id} className="acc-muted mt-2">
                <Amount value={row.remainingMinor / 10 ** row.sourceDecimals} currency={row.currency} /> = <Amount value={row.paymentMinor / 10 ** salaryDecimals} currency={salaryCurrency} /> · سعر المصدر {row.sourceRate}، سعر الصرف {row.targetRate} مقابل الدولار
              </div>)}
              <FormControlLabel className="mt-3" control={<Checkbox checked={!!salary.closeCommissions} disabled={posting}
                onChange={(_, checked) => setSalary({ ...salary, closeCommissions: checked })} />} label="هذه الدفعة نهائية · إقفال العمولة وإلغاء المتبقي" />
              {salary.closeCommissions && <>
                <Alert severity="info" className="mt-2">ستُقفل جميع عمولات هذا الشهر المتاحة حتى تاريخ الصرف. يُحفظ المبلغ المدفوع، ويُلغى المتبقي ({Math.max(0, Number(((salaryPreview?.availableAmount || 0) - salaryNet).toFixed(salaryDecimals)))} {salaryCurrency}) دون اعتباره دفعة نقدية.</Alert>
                <TextField fullWidth className="mt-3" label="بيان التسوية النهائية" value={salary.commissionCloseReason} disabled={posting}
                  onChange={(e) => setSalary({ ...salary, commissionCloseReason: e.target.value })} inputProps={{ maxLength: 1000 }} />
              </>}
            </> : <>
            <TextField type="number" label={`الراتب الأساسي (${salary.employee.salaryCurrency || 'USD'})`} value={salary.baseSalary} onChange={(e) => setSalary({ ...salary, baseSalary: e.target.value })} fullWidth className="mt-3" />
            <TextField label={`المبلغ الذي سيُصرف بعد الخصم (${salaryCurrency})`} value={salaryPreview ? salaryNet : ''} InputProps={{ readOnly: true }} fullWidth className="mt-3" />
            {salaryPreview && <Alert severity="info" className="mt-3">الراتب الأساسي − الخصومات ({salaryPreview.salaryDeduction}) = {salaryGross} {salaryCurrency}. الصافي بعد خصم السلفة: {salaryNet}. العمولات تُصرف بشكل مستقل.</Alert>}
            <TextField type="number" label="خصم من السلفة" value={salary.advanceDeduction} onChange={(e) => setSalary({ ...salary, advanceDeduction: e.target.value })} fullWidth className="mt-3"
              helperText={<>عليه سلفة <Balances value={salary.employee.loan} />. يُخصم من السلفة بعملة الخزينة فقط (العهدة لا تُخصم من الراتب)</>} />
            </>}
            {salaryCash?.currency && salaryCash.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر تاريخ العملية)" value={salary.rate} onChange={(e) => setSalary({ ...salary, rate: e.target.value })} fullWidth className="mt-3" />}
          </DialogContent>
        )}
        <DialogActions>
          <Button disabled={posting} onClick={() => setSalary(null)}>إلغاء</Button>
          <Button variant="contained" disabled={posting || !salaryPreview || !!salaryPreviewError || !salary?.office || !salary?.paidFromAccountId || !Number.isFinite(salaryGross) || !(salaryGross > 0) || (commissionPayment ? salaryGross > Number(salaryPreview?.availableAmount || 0) || (salary?.closeCommissions && !salary?.commissionCloseReason?.trim()) : salaryCurrency !== salary?.employee.salaryCurrency || Number(salary?.advanceDeduction || 0) > salaryGross)} onClick={() => submit('salaries', {
            employeeId: salary.employee._id, month: salary.month, day: salary.day, office: salary.office, paidFromAccountId: salary.paidFromAccountId,
            paymentKind: commissionPayment ? 'commission' : 'salary', grossAmount: commissionPayment ? salaryGross : undefined,
            expectedCommissionPreview: commissionPayment ? salaryPreview.fingerprint : undefined,
            closeCommissions: commissionPayment && !!salary.closeCommissions, commissionCloseReason: commissionPayment ? salary.commissionCloseReason : undefined,
            structuredSalary: true, baseSalary: Number(salary.baseSalary), expectedNetAmount: salaryNet, advanceDeduction: commissionPayment ? 0 : Number(salary.advanceDeduction) || 0, rate: Number(salary.rate) || undefined,
          }, () => setSalary(null))}>{commissionPayment ? 'تأكيد صرف العمولة' : 'تأكيد صرف الراتب'}</Button>
        </DialogActions>
      </Dialog>

      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingSalaryPayment" id={cancel._id} title={`${cancel.paymentKind === 'commission' ? 'العمولة' : 'الراتب'} ${cancel.number}`} />}
    </>
  );
};

export default Employees;
