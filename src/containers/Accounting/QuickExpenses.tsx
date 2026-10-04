import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { amountLabel, today } from './shared';
import { Amount, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';
import { beforeCountText, isBeforeCount, useCountDay } from '../../utils/useCountDay';
import { ListFilters, ListFilterValue, queryOf } from './ListFilters';

const RECENT_FILTERS: ListFilterValue = { status: '', from: '', to: '', search: '' };

// Rent, electricity, fuel...: a one-line bill to the "cash expenses" vendor, paid on the spot
const QuickExpenses = () => {
  const navigate = useNavigate();
  const { accounts, offices } = useAccountingData();
  const [types, setTypes] = useState<any[]>([]);
  const [cashVendor, setCashVendor] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ typeId: '', description: '', amount: '', fromAccountId: '', office: '', day: today(), rate: '' });
  const [message, setMessage] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const idempotencyKey = useRef(newKey());

  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);
  const from = cashAccounts.find((a) => a._id === form.fromAccountId);
  // An old expense dated on or before the count day is already out of the counted box: accounting
  // takes it from the opening balance by itself, this only says so
  const count = useCountDay();
  const beforeCount = isBeforeCount(count, form.day);
  const type = types.find((t) => t._id === form.typeId);

  const [filters, setFilters] = useState<ListFilterValue>(RECENT_FILTERS);
  const loadRecent = (current: ListFilterValue = filters) => acc.get('bills', { quick: 'true', limit: 100, ...queryOf(current) }).then((res: any) => setRecent(res.data.results)).catch(() => {}).finally(() => setIsLoading(false));
  useEffect(() => {
    acc.get('expense-types', { active: 'true' }).then((res: any) => setTypes(res.data.results)).catch(() => {});
    acc.get('vendors').then((res: any) => setCashVendor(res.data.results.find((v: any) => v.seedKey === 'cash_expenses'))).catch(() => {});
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    try {
      setIsSaving(true);
      await acc.post('bills', {
        vendorId: cashVendor._id, day: form.day, currency: from?.currency || 'USD', rate: Number(form.rate) || undefined,
        isQuickExpense: true, paidImmediatelyFrom: form.fromAccountId, idempotencyKey: idempotencyKey.current,
        lines: [{ description: form.description || type?.name, amount: Number(form.amount), target: 'expense', accountId: type.accountId?._id || type.accountId, office: form.office }],
      });
      setMessage({ type: 'success', text: 'تم تسجيل المصروف.' });
      idempotencyKey.current = newKey();
      setForm({ ...form, description: '', amount: '' });
      loadRecent();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsSaving(false);
  };

  return (
    <>
      <PageHeader title="مصروفات سريعة" subtitle="للمصروفات التشغيلية المدفوعة فوراً (إيجار، كهرباء، وقود...). فواتير الموردين الآجلة تُسجَّل من «فواتير الموردين»." />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel title="مصروف جديد">
        <div className="acc-form-grid">
          <TextField select label="نوع المصروف" value={form.typeId} onChange={(e) => {
            const picked = types.find((t) => t._id === e.target.value);
            setForm({ ...form, typeId: e.target.value, office: form.office || picked?.defaultOffice || '' });
          }}>
            {types.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
          </TextField>
          <TextField label="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={type?.name} />
          <TextField select label="دُفع من" value={form.fromAccountId} onChange={(e) => {
            const account = cashAccounts.find((a) => a._id === e.target.value);
            setForm({ ...form, fromAccountId: e.target.value, office: account?.office || form.office });
          }}>
            {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
          </TextField>
          <TextField type="number" label={amountLabel(from?.currency)} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          {from?.currency && from.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر تاريخ العملية)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />}
          <TextField select label="المكتب" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })}>
            {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
          </TextField>
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        </div>
        {beforeCount && count && <Alert severity="info" className="mt-3">{beforeCountText(count)}</Alert>}
        <div className="d-flex justify-content-end mt-3">
          <Button variant="contained" disabled={isSaving || !cashVendor || !type || !from || !form.office || !(Number(form.amount) > 0)} onClick={save}>تسجيل المصروف</Button>
        </div>
      </Panel>

      <Panel flush title="المصروفات السريعة">
        <div className="px-3">
          <ListFilters value={filters} onChange={setFilters} onApply={loadRecent} blank={RECENT_FILTERS} searchLabel="الوصف أو رقم الفاتورة">
            <TextField size="small" select label="الحالة" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ minWidth: 130 }}>
              <MenuItem value="">غير الملغاة</MenuItem>
              <MenuItem value="all">الكل مع الملغاة</MenuItem>
              <MenuItem value="canceled">ملغاة</MenuItem>
            </TextField>
          </ListFilters>
        </div>
        <DataTable
          loading={isLoading}
          rows={recent}
          rowKey={(row: any) => row._id}
          onRowClick={(row: any) => navigate(`/accounting/bills/${row._id}`)}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد مصروفات بعد', hint: 'سجّل أول مصروف من النموذج أعلاه.' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'description', header: 'المصروف', render: (row: any) => <>{row.lines[0]?.description}<Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'office', header: 'المكتب', hideOnMobile: true, render: (row: any) => OFFICE_LABELS[row.lines[0]?.office] || row.lines[0]?.office },
            { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Amount value={row.total} currency={row.currency} /> },
            { key: 'usd', header: 'بالدولار', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.totalUsd} strong /> },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Panel>
    </>
  );
};

export default QuickExpenses;
