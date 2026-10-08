import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { ArrowLeftRight, ClipboardCheck } from 'lucide-react';
import { CURRENCY_DECIMALS, acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, RemotePicker, today, userLabel } from './shared';
import { cancelAction, useBulk } from './bulk';
import { AccountRef, Amount, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';
import { SubBoxesPanel } from './SubBoxes';
import { ListFilters, ListFilterValue, queryOf } from './ListFilters';

const TRANSFER_FILTERS: ListFilterValue = { accountId: '', status: '', from: '', to: '', search: '' };
const COUNT_FILTERS: ListFilterValue = { accountId: '', from: '', to: '' };

const Treasury = () => {
  const { accounts, reload } = useAccountingData();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [counts, setCounts] = useState<any[]>([]);
  const [transfer, setTransfer] = useState<any>(null);
  const [count, setCount] = useState<any>(null);
  const [systemBalance, setSystemBalance] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const key = useRef(newKey());

  const moneyAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && (a.isCash || a.requires?.includes('employee'))), [accounts]);
  const cashAccounts = moneyAccounts.filter((a) => a.isCash);
  const byId = (id: string) => moneyAccounts.find((a) => a._id === id);

  const [transferFilters, setTransferFilters] = useState<ListFilterValue>(TRANSFER_FILTERS);
  const [countFilters, setCountFilters] = useState<ListFilterValue>(COUNT_FILTERS);
  const load = async (tf: ListFilterValue = transferFilters, cf: ListFilterValue = countFilters) => {
    const [t, c] = await Promise.all([acc.get('transfers', { ...queryOf(tf), limit: 200 }), acc.get('cash-counts', { ...queryOf(cf), limit: 200 })]);
    setTransfers(t.data.results);
    setCounts(c.data.results);
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => setIsLoading(false)); }, []);

  useEffect(() => {
    if (!count?.accountId) { setSystemBalance(null); return; }
    acc.get(`balances/${count.accountId}`).then((res: any) => setSystemBalance(res.data)).catch(() => {});
  }, [count?.accountId]);

  const submit = async (path: string, body: any, done: () => void) => {
    try {
      await acc.post(path, { ...body, idempotencyKey: key.current });
      key.current = newKey();
      setMessage({ type: 'success', text: 'تم الترحيل.' });
      done();
      await Promise.all([load(), reload()]);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const afterBulk = () => Promise.all([load(), reload()]);
  const transferBulk = useBulk<any>({
    rows: transfers, rowKey: (row) => row._id, rowLabel: (row) => row.number, onDone: afterBulk,
    actions: [cancelAction('AccountingTreasuryTransfer', 'إلغاء التحويلات', 'التحويل الذي يجعل الخزينة المستلمة سالبة يُرفض ويبقى كما هو.')],
  });
  const countBulk = useBulk<any>({
    rows: counts, rowKey: (row) => row._id, rowLabel: (row) => row.number, onDone: afterBulk,
    actions: [cancelAction('AccountingCashCount', 'إلغاء الجرد', 'يُعكس قيد العجز أو الزيادة.', (row) => row.status === 'posted' && !!row.entryId)],
  });

  const fromAccount = transfer && byId(transfer.fromAccountId);
  const toAccount = transfer && byId(transfer.toAccountId);
  const toIsUsdValued = toAccount && !toAccount.currency;
  const needsEmployee = [fromAccount, toAccount].some((a) => a?.requires?.includes('employee'));
  const feesFromAccount = transfer && byId(transfer.feesFromAccountId);
  useEffect(() => {
    if (needsEmployee) setTransfer((current: any) => current?.hasFees ? { ...current, hasFees: false, fees: '', feesFromAccountId: '' } : current);
  }, [needsEmployee]);
  const countAccount = count && byId(count.accountId);
  const countDecimals = CURRENCY_DECIMALS[countAccount?.currency || 'USD'] ?? 2;

  return (
    <>
      <PageHeader
        title="الخزينة والتحويلات"
        subtitle="تحويل بين الخزائن والبنوك وAlipay وعهد الموظفين، وصرف العملات، وجرد الخزائن."
        actions={<>
          <Button variant="outlined" startIcon={<ClipboardCheck size={16} />} onClick={() => setCount({ day: today(), accountId: '', countedAmount: '', note: '' })}>جرد خزينة</Button>
          <Button variant="contained" startIcon={<ArrowLeftRight size={16} />} onClick={() => setTransfer({ day: today(), fromAccountId: '', fromAmount: '', toAccountId: '', toAmount: '', hasFees: false, feesFromAccountId: '', fees: '', note: '', employee: null })}>تحويل جديد</Button>
        </>}
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <SubBoxesPanel canHandOver onChanged={() => load()} />

      <Panel flush title="التحويلات وصرف العملات" subtitle="شراء عملة يحفظ تكلفتها الحقيقية؛ مثلاً 71,000 يوان مقابل 10,000$ تُحمل بسعر 7.1.">
        <div className="px-3">
          <ListFilters value={transferFilters} onChange={setTransferFilters} onApply={(value) => load(value, countFilters)} blank={TRANSFER_FILTERS}>
            <TextField size="small" select label="الحساب" value={transferFilters.accountId} onChange={(e) => setTransferFilters({ ...transferFilters, accountId: e.target.value })} style={{ minWidth: 200 }}>
              <MenuItem value="">كل الحسابات</MenuItem>
              {moneyAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="الحالة" value={transferFilters.status} onChange={(e) => setTransferFilters({ ...transferFilters, status: e.target.value })} style={{ minWidth: 130 }}>
              <MenuItem value="">غير الملغاة</MenuItem>
              <MenuItem value="all">الكل مع الملغاة</MenuItem>
              <MenuItem value="canceled">ملغاة</MenuItem>
            </TextField>
          </ListFilters>
        </div>
        {transferBulk.bar}
        <DataTable
          selection={transferBulk.selection}
          loading={isLoading}
          rows={transfers}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد تحويلات بعد' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'from', header: 'من', render: (row: any) => <AccountRef code={row.fromAccountId?.code} name={row.fromAccountId?.name} /> },
            { key: 'to', header: 'إلى', render: (row: any) => <><AccountRef code={row.toAccountId?.code} name={row.toAccountId?.name} />{row.employeeId && <Sub>{row.employeeId.firstName} {row.employeeId.lastName}</Sub>}</> },
            { key: 'sent', header: 'المُرسل', numeric: true, render: (row: any) => <Amount value={row.fromAmount} currency={row.fromAccountId?.currency || 'USD'} /> },
            { key: 'received', header: 'المُستلم', numeric: true, render: (row: any) => <Amount value={row.toAmount} currency={row.toAccountId?.currency || 'USD'} /> },
            { key: 'fees', header: 'رسوم التحويل', numeric: true, render: (row: any) => row.fees ? <><Amount value={row.fees} currency={row.feesCurrency || row.feesFromAccountId?.currency || row.fromAccountId?.currency || 'USD'} /><Sub>دُفعت من: {(row.feesFromAccountId || row.fromAccountId)?.name}</Sub></> : <span className="acc-muted">بلا رسوم</span> },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel({ model: 'AccountingTreasuryTransfer', doc: row })}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>

      <Panel flush title="جرد الخزائن" subtitle="اكتب المبلغ الموجود فعلاً؛ الفرق عن الدفاتر يُسجَّل عجزاً أو زيادة.">
        <div className="px-3">
          <ListFilters value={countFilters} onChange={setCountFilters} onApply={(value) => load(transferFilters, value)} blank={COUNT_FILTERS} searchLabel={null}>
            <TextField size="small" select label="الحساب" value={countFilters.accountId} onChange={(e) => setCountFilters({ ...countFilters, accountId: e.target.value })} style={{ minWidth: 200 }}>
              <MenuItem value="">كل الحسابات</MenuItem>
              {moneyAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
          </ListFilters>
        </div>
        {countBulk.bar}
        <DataTable
          selection={countBulk.selection}
          loading={isLoading}
          rows={counts}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا يوجد جرد بعد' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'account', header: 'الخزينة', render: (row: any) => <AccountRef code={row.accountId?.code} name={row.accountId?.name} /> },
            { key: 'system', header: 'في الدفاتر', numeric: true, render: (row: any) => <Money value={row.systemAmount} currency={row.accountId?.currency} decimals={CURRENCY_DECIMALS[row.accountId?.currency || 'USD']} tone="plain" /> },
            { key: 'counted', header: 'المعدود', numeric: true, render: (row: any) => <Amount value={row.countedAmount} currency={row.accountId?.currency} /> },
            { key: 'difference', header: 'الفرق', numeric: true, render: (row: any) => (row.difference ? <Money value={row.difference} currency={row.accountId?.currency} decimals={CURRENCY_DECIMALS[row.accountId?.currency || 'USD']} strong /> : <span className="acc-muted">مطابق</span>) },
            { key: 'status', header: 'الحالة', hideOnMobile: true, render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' && row.entryId ? <Button size="small" color="error" onClick={() => setCancel({ model: 'AccountingCashCount', doc: row })}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>

      <Dialog open={!!transfer} onClose={() => setTransfer(null)} maxWidth="sm" fullWidth>
        <DialogTitle>تحويل جديد</DialogTitle>
        {transfer && (
          <DialogContent>
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={transfer.day} onChange={(e) => setTransfer({ ...transfer, day: e.target.value })} className="mt-2" />
            <div className="d-flex gap-2 mt-3">
              <TextField select label="من" value={transfer.fromAccountId} onChange={(e) => setTransfer({ ...transfer, fromAccountId: e.target.value })} fullWidth>
                {moneyAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
              </TextField>
              <TextField type="number" label={`المُرسل (${fromAccount?.currency || 'USD'})`} helperText="المبلغ دون رسوم التحويل" value={transfer.fromAmount} onChange={(e) => setTransfer({ ...transfer, fromAmount: e.target.value })} style={{ width: 170 }} />
            </div>
            <div className="d-flex gap-2 mt-3">
              <TextField select label="إلى" value={transfer.toAccountId} onChange={(e) => setTransfer({ ...transfer, toAccountId: e.target.value })} fullWidth>
                {moneyAccounts.filter((a) => a._id !== transfer.fromAccountId).map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
              </TextField>
              <TextField type="number" label={`المُستلم (${toAccount?.currency || 'USD'})`} value={toIsUsdValued ? '' : transfer.toAmount} disabled={toIsUsdValued}
                helperText={toIsUsdValued ? 'يستلم القيمة بالدولار' : undefined} onChange={(e) => setTransfer({ ...transfer, toAmount: e.target.value })} style={{ width: 170 }} />
            </div>
            {needsEmployee && <div className="mt-3"><RemotePicker endpoint="lookup/users" label="الموظف" value={transfer.employee} getLabel={userLabel} onChange={(employee) => setTransfer({ ...transfer, employee })} /></div>}
            <div className="mt-3">
              <FormControlLabel control={<Checkbox checked={!!transfer.hasFees} disabled={needsEmployee} onChange={e => setTransfer({ ...transfer, hasFees: e.target.checked, fees: '', feesFromAccountId: e.target.checked ? transfer.fromAccountId : '' })} />} label="هل دفعت رسوم تحويل؟" />
              {needsEmployee && <Sub>الرسوم لا تُضاف إلى عمليات إعطاء العهد والسلف أو إرجاعها.</Sub>}
              {transfer.hasFees && <>
                <TextField select required label="الخزينة التي دفعت منها الرسوم" value={transfer.feesFromAccountId} onChange={e => setTransfer({ ...transfer, feesFromAccountId: e.target.value, fees: '' })} fullWidth className="mt-2">
                  {cashAccounts.map(a => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
                </TextField>
                <TextField type="number" required label={`قيمة الرسوم (${feesFromAccount?.currency || 'USD'})`} value={transfer.fees} disabled={!feesFromAccount} inputProps={{ min: 0, step: 'any' }} onChange={e => setTransfer({ ...transfer, fees: e.target.value })} fullWidth className="mt-3" helperText="تُخصم من الخزينة المختارة وتُسجّل كمصروف رسوم تحويل، منفصلة عن أصل المبلغ." />
              </>}
            </div>
            <TextField label="ملاحظة" value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} fullWidth className="mt-3" />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setTransfer(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!transfer?.fromAccountId || !transfer?.toAccountId || !(Number(transfer?.fromAmount) > 0) || (transfer?.hasFees && (!transfer?.feesFromAccountId || !Number.isFinite(Number(transfer?.fees)) || !(Number(transfer?.fees) > 0)))} onClick={() => submit('transfers', {
            day: transfer.day, fromAccountId: transfer.fromAccountId, fromAmount: Number(transfer.fromAmount), toAccountId: transfer.toAccountId,
            toAmount: Number(transfer.toAmount) || undefined, hasFees: !!transfer.hasFees, fees: transfer.hasFees ? Number(transfer.fees) : 0,
            feesFromAccountId: transfer.hasFees ? transfer.feesFromAccountId : undefined, note: transfer.note || undefined, employeeId: transfer.employee?._id,
          }, () => setTransfer(null))}>ترحيل</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!count} onClose={() => setCount(null)} maxWidth="xs" fullWidth>
        <DialogTitle>جرد خزينة</DialogTitle>
        {count && (
          <DialogContent>
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={count.day} onChange={(e) => setCount({ ...count, day: e.target.value })} className="mt-2" />
            <TextField select label="الخزينة" value={count.accountId} onChange={(e) => setCount({ ...count, accountId: e.target.value })} fullWidth className="mt-3">
              {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            {systemBalance && <div className="mt-2 acc-muted">في الدفاتر: <Money value={systemBalance.foreign} currency={countAccount?.currency || 'USD'} decimals={countDecimals} tone="plain" /></div>}
            <TextField type="number" label={`المعدود فعلاً (${countAccount?.currency || ''})`} value={count.countedAmount} onChange={(e) => setCount({ ...count, countedAmount: e.target.value })} fullWidth className="mt-3" />
            <TextField label="ملاحظة" value={count.note} onChange={(e) => setCount({ ...count, note: e.target.value })} fullWidth className="mt-3" />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setCount(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!count?.accountId || count?.countedAmount === ''} onClick={() => submit('cash-counts', {
            day: count.day, accountId: count.accountId, countedAmount: Number(count.countedAmount), note: count.note || undefined,
          }, () => setCount(null))}>ترحيل</Button>
        </DialogActions>
      </Dialog>

      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={() => { load(); reload(); }} model={cancel.model} id={cancel.doc._id} title={cancel.doc.number}
        askConfirm={cancel.model === 'AccountingTreasuryTransfer' ? 'الإلغاء حتى لو أصبح الحساب المستلم سالباً' : undefined} />}
    </>
  );
};

export default Treasury;
