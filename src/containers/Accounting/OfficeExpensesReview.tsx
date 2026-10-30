import { useCallback, useEffect, useState } from 'react';
import { Button, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText } from './accountingApi';
import { CancelDialog } from './shared';
import { useAccountingAccess } from './useAccountingAccess';
import { useAccountingData } from './useAccountingData';
import { Amount, DataTable, FilterBar, Ltr, Money, Notice, Open, PageHeader, Panel, StatusBadge, Sub } from './ui';

// Office expenses entered by staff on the system's Expenses screen (spec 19.1), from every office:
// filters by office, person, type and period, the receipts, and cancelling (reversing) one.
const OfficeExpensesReview = () => {
  const access = useAccountingAccess();
  const { offices } = useAccountingData();
  const [filters, setFilters] = useState({ office: '', createdBy: '', expenseTypeId: '', from: '', to: '', status: 'posted' });
  const [data, setData] = useState<{ results: any[]; staff: any[]; types: any[] }>({ results: [], staff: [], types: [] });
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canceling, setCanceling] = useState<any>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    acc.get('office-expenses', params)
      .then((res: any) => setData(res.data))
      .catch((err: any) => setMessage({ type: 'error', text: errorText(err) }))
      .finally(() => setIsLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (field: string) => (event: any) => setFilters({ ...filters, [field]: event.target.value });
  const totalUsd = data.results.filter((row) => row.status === 'posted').reduce((sum, row) => sum + (row.usd || 0), 0);

  return (
    <>
      <PageHeader title="مصروفات المكاتب" subtitle="ما سجّله الموظفون من شاشة «المصروفات» في المنظومة. كل مصروف قيد على خزينة مكتبه. الموظف يعدّل أو يحذف في يوم الإدخال فقط؛ بعده التصحيح بالإلغاء من هنا." />
      <Notice message={message} onClose={() => setMessage(null)} />
      <FilterBar>
        <TextField select size="small" label="المكتب" value={filters.office} onChange={set('office')} style={{ minWidth: 150 }}>
          <MenuItem value="">كل المكاتب</MenuItem>
          {offices.map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="الموظف" value={filters.createdBy} onChange={set('createdBy')} style={{ minWidth: 170 }}>
          <MenuItem value="">الكل</MenuItem>
          {data.staff.map((p) => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="النوع" value={filters.expenseTypeId} onChange={set('expenseTypeId')} style={{ minWidth: 170 }}>
          <MenuItem value="">كل الأنواع</MenuItem>
          {data.types.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={set('from')} />
        <TextField size="small" type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={set('to')} />
        <TextField select size="small" label="الحالة" value={filters.status} onChange={set('status')} style={{ minWidth: 130 }}>
          <MenuItem value="posted">مُرحَّل</MenuItem>
          <MenuItem value="canceled">ملغى</MenuItem>
          <MenuItem value="">الكل</MenuItem>
        </TextField>
      </FilterBar>
      <Panel flush title={`المصروفات (${data.results.length})`} subtitle={<>المجموع بالدولار <Money value={totalUsd} /></>}>
        <DataTable
          rows={data.results} rowKey={(row: any) => row._id} loading={isLoading}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا مصروفات بهذه الفلاتر' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'office', header: 'المكتب', render: (row: any) => OFFICE_LABELS[row.office] || row.office },
            { key: 'type', header: 'النوع', render: (row: any) => <>{row.type}{row.note && <Sub>{row.note}</Sub>}</> },
            { key: 'by', header: 'الموظف', hideOnMobile: true, render: (row: any) => row.createdBy?.name || '' },
            { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Amount value={row.amount} currency={row.currency} /> },
            { key: 'usd', header: 'بالدولار', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.usd} /> },
            { key: 'receipt', header: 'الإيصال', render: (row: any) => (row.attachments?.[0] ? <a href={row.attachments[0].path} target="_blank" rel="noreferrer">عرض</a> : null) },
            { key: 'status', header: 'الحالة', render: (row: any) => <><StatusBadge status={row.status} />{row.cancelReason && <Sub>{row.cancelReason}</Sub>}</> },
            {
              key: 'actions', header: '', render: (row: any) => (
                <div className="d-flex gap-2 align-items-center">
                  <Open to={`/accounting/bills/${row._id}`}>الفاتورة</Open>
                  {row.status === 'posted' && access.can('cancel') && <Button size="small" color="error" onClick={() => setCanceling(row)}>إلغاء</Button>}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <CancelDialog
        open={!!canceling} onClose={() => setCanceling(null)} onDone={load}
        model="AccountingSupplierBill" id={canceling?._id || ''} title={`المصروف ${canceling?.number || ''}`}
      />
    </>
  );
};

export default OfficeExpensesReview;
