import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { OFFICE_LABELS, acc, errorText } from './accountingApi';
import { CancelDialog, useVendors } from './shared';
import { useBulk } from './bulk';
import { Amount, Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, StatusBadge, Sub } from './ui';

const PAGE_SIZE = 50;
export const TARGET_LABELS: Record<string, string> = { trip: 'تكلفة رحلة', order: 'تكلفة طلب شراء', expense: 'مصروف', asset: 'أصل ثابت', prepaid: 'مصروف مقدم', customs: 'تخليص جمركي لطرد' };

// A posted bill's status by what is still owed on it (owner's request 2026-10-04): paid once paid,
// partly paid, or plain "posted" while nothing is paid. Drafts and cancelled bills keep theirs.
export const BillStatus = ({ bill, open, paymentStatus }: { bill: any; open?: number; paymentStatus?: string }) => {
  if (bill.status !== 'posted' || bill.isCreditNote || !paymentStatus) return <StatusBadge status={bill.status} />;
  if (paymentStatus === 'paid') return <Badge tone="ok">مدفوعة</Badge>;
  if (paymentStatus === 'partial') return <><Badge tone="warn">مدفوعة جزئياً</Badge><Sub>باقي <Money value={open || 0} tone="plain" /></Sub></>;
  return <><Badge tone="info">مُرحَّلة</Badge><Sub>غير مدفوعة</Sub></>;
};

export const BillsList = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { vendors } = useVendors();
  const [filters, setFilters] = useState({ vendorId: '', status: '', payment: '', target: '', from: '', to: '', search: '', tripId: params.get('tripId') || '' });
  const [data, setData] = useState<any>({ results: [], total: 0, page: 1 });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async (page = 1, current = filters) => {
    try {
      setIsLoading(true);
      const query: any = { page, limit: PAGE_SIZE };
      Object.entries(current).forEach(([key, value]) => { if (value) query[key] = value; });
      setData((await acc.get('bills', query)).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(1); }, []);
  const pages = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);

  const bulk = useBulk<any>({
    rows: data.results,
    rowKey: (row) => row._id,
    rowLabel: (row) => row.number || `مسودة ${row.day}`,
    onDone: () => load(data.page),
    actions: [
      {
        key: 'post', label: 'ترحيل المسودات', done: 'رُحِّلت', applies: (row) => row.status === 'draft',
        run: (row) => acc.post(`bills/${row._id}/post`),
        confirm: (count) => `سيُرحَّل ${count} فاتورة مسودة وتُنشأ قيودها. بعد الترحيل لا تُعدَّل ولا تُحذف، فقط تُلغى.`,
      },
      {
        key: 'delete', label: 'حذف المسودات', done: 'حُذفت', danger: true, applies: (row) => row.status === 'draft',
        run: (row) => acc.delete(`bills/${row._id}`),
        confirm: (count) => `سيُحذف ${count} مسودة نهائياً. المسودات لا قيود لها، فلا أثر في الدفاتر.`,
      },
      {
        key: 'cancel', label: 'إلغاء المُرحَّلة', done: 'أُلغيت', danger: true, needsReason: true, applies: (row) => row.status === 'posted',
        run: (row, reason) => acc.post(`documents/AccountingSupplierBill/${row._id}/cancel`, { reason }),
        confirm: (count) => `سيُلغى ${count} فاتورة مُرحَّلة بقيد عكسي لكل منها، وتبقى ظاهرة بحالة «ملغى». الفاتورة التي عليها دفعات أو إشعار دائن تُرفض وتبقى كما هي.`,
      },
    ],
  });

  return (
    <>
      <PageHeader
        title="فواتير الموردين"
        subtitle="كل تكلفة تدخل من هنا: شركات الشحن، موردو طلبات الشراء، الخدمات، والأصول."
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => navigate('/accounting/bills/new')}>فاتورة جديدة</Button>}
      />
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField select label="المورد" value={filters.vendorId} onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })} style={{ minWidth: 200 }}>
              <MenuItem value="">كل الموردين</MenuItem>
              {vendors.map((v) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
            </TextField>
            <TextField select label="الحالة" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ minWidth: 130 }}>
              <MenuItem value="">غير الملغاة</MenuItem>
              <MenuItem value="all">الكل مع الملغاة</MenuItem>
              <MenuItem value="draft">مسودة</MenuItem>
              <MenuItem value="posted">مُرحَّلة</MenuItem>
              <MenuItem value="canceled">ملغاة</MenuItem>
            </TextField>
            <TextField select label="الدفع" value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })} style={{ minWidth: 140 }}>
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="unpaid">غير مدفوعة</MenuItem>
              <MenuItem value="partial">مدفوعة جزئياً</MenuItem>
              <MenuItem value="paid">مدفوعة</MenuItem>
            </TextField>
            <TextField select label="مُحمَّلة على" value={filters.target} onChange={(e) => setFilters({ ...filters, target: e.target.value })} style={{ minWidth: 150 }}>
              <MenuItem value="">الكل</MenuItem>
              {Object.entries(TARGET_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <TextField placeholder="رقم الفاتورة أو الوصف" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load(1)} />
            <Button variant="outlined" onClick={() => load(1)}>بحث</Button>
            {filters.tripId && <Chip label="رحلة واحدة فقط" onDelete={() => { const next = { ...filters, tripId: '' }; setFilters(next); load(1, next); }} />}
          </FilterBar>
        </div>
        {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={data.results}
          rowKey={(row: any) => row._id}
          onRowClick={(row: any) => navigate(`/accounting/bills/${row._id}`)}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد فواتير', hint: 'أضف فاتورة مورد أو مصروفاً سريعاً ليظهر هنا.', action: <Button variant="outlined" onClick={() => navigate('/accounting/bills/new')}>فاتورة جديدة</Button> }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr>, sortValue: (row: any) => row.day },
            {
              key: 'number', header: 'الفاتورة', render: (row: any) => (
                <>
                  <Ltr>{row.number || 'مسودة'}</Ltr> {row.isCreditNote && <Badge tone="info">إشعار دائن</Badge>}
                  <Sub>{row.lines[0]?.description}{row.lines.length > 1 ? ` و${row.lines.length - 1} سطر آخر` : ''}</Sub>
                </>
              ),
            },
            { key: 'vendor', header: 'المورد', render: (row: any) => row.vendorId?.name, sortValue: (row: any) => row.vendorId?.name || '' },
            {
              key: 'target', header: 'مُحمَّلة على', hideOnMobile: true, render: (row: any) => (
                <span className="d-inline-flex gap-1 flex-wrap">
                  {row.lines.map((l: any) => l.target).filter((t: string, i: number, all: string[]) => all.indexOf(t) === i).map((t: string) => <Badge key={t} tone="muted">{TARGET_LABELS[t]}</Badge>)}
                  {row.refs?.length > 0 && <span className="acc-muted small"><Ltr>{row.refs.slice(0, 2).join('، ')}{row.refs.length > 2 ? ` +${row.refs.length - 2}` : ''}</Ltr></span>}
                </span>
              ),
            },
            { key: 'total', header: 'المبلغ', numeric: true, render: (row: any) => <Amount value={row.total ?? row.lines.reduce((s: number, l: any) => s + l.amount, 0)} currency={row.currency} /> },
            { key: 'usd', header: 'بالدولار', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.totalUsd} hideZero strong />, sortValue: (row: any) => row.totalUsd || 0 },
            { key: 'status', header: 'الحالة', render: (row: any) => <BillStatus bill={row} open={row.open} paymentStatus={row.paymentStatus} /> },
          ]}
        />
        {pages > 1 && (
          <div className="d-flex justify-content-end gap-2 px-3 py-2">
            <Button size="small" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>السابق</Button>
            <Button size="small" disabled={data.page >= pages} onClick={() => load(data.page + 1)}>التالي</Button>
          </div>
        )}
      </Panel>
    </>
  );
};

export const BillDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = async () => {
    try { setData((await acc.get(`bills/${id}`)).data); } catch (err) { setError(errorText(err)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const postDraft = async () => { try { await acc.post(`bills/${id}/post`); await load(); } catch (err) { setError(errorText(err)); } };
  const deleteDraft = async () => {
    if (!window.confirm('حذف هذه المسودة؟')) return;
    try { await acc.delete(`bills/${id}`); navigate('/accounting/bills'); } catch (err) { setError(errorText(err)); }
  };

  if (!data) return error ? <Alert severity="error">{error}</Alert> : <div className="acc-empty">جارٍ التحميل…</div>;
  const { bill, payments, creditNotes, entries, open, paymentStatus, trips, orders } = data;
  const nameOf = (list: any[], value: string, field: string) => list.find((item: any) => item._id === value)?.[field] || value;

  return (
    <>
      <PageHeader
        title={<>{bill.isCreditNote ? 'إشعار دائن' : 'فاتورة'} <Ltr>{bill.number || '(مسودة)'}</Ltr> <BillStatus bill={bill} open={open} paymentStatus={paymentStatus} /></>}
        subtitle={<>
          {bill.vendorId?.name} · <Ltr>{bill.day}</Ltr>{bill.vendorRef && <> · رقم فاتورة المورد <Ltr>{bill.vendorRef}</Ltr></>}
          {' · '}<Ltr>{bill.currency}</Ltr>{bill.rate ? <> بسعر <Ltr>{bill.rate}</Ltr></> : null}
          {bill.createdBy && ` · بواسطة ${bill.createdBy.firstName} ${bill.createdBy.lastName}`}
        </>}
        actions={<>
          {bill.status === 'draft' && <>
            <Button variant="outlined" onClick={() => navigate(`/accounting/bills/${id}/edit`)}>تعديل</Button>
            <Button color="error" onClick={deleteDraft}>حذف المسودة</Button>
            <Button variant="contained" onClick={postDraft}>ترحيل</Button>
          </>}
          {bill.status === 'posted' && <>
            {!bill.isCreditNote && open > 0 && <Button variant="contained" onClick={() => navigate(`/accounting/payments/new?vendorId=${bill.vendorId?._id}&billId=${bill._id}`)}>دفع</Button>}
            {!bill.isCreditNote && <Button variant="outlined" onClick={() => navigate(`/accounting/bills/new?creditFor=${bill._id}`)}>إشعار دائن</Button>}
            <Button color="error" variant="outlined" onClick={() => setCancelOpen(true)}>إلغاء</Button>
          </>}
        </>}
      />
      {error && <Alert severity="error" className="mb-2">{error}</Alert>}
      {bill.cancelReason && <Alert severity="info" className="mb-2">أُلغيت: {bill.cancelReason}</Alert>}

      {open !== null && (
        <StatGrid>
          <Stat label="إجمالي الفاتورة" value={<Money value={bill.totalUsd} />} hint={<Amount value={bill.total} currency={bill.currency} />} />
          <Stat label="المتبقي للمورد" value={<Money value={open} />} tone={open > 0 ? 'warn' : 'accent'} hint={open > 0 ? 'لم تُسدَّد بالكامل' : 'مسددة'} />
        </StatGrid>
      )}

      <Panel flush title="السطور">
        <DataTable
          rows={bill.lines}
          rowKey={(row: any) => row._id}
          columns={[
            {
              key: 'target', header: 'مُحمَّل على', render: (line: any) => (
                <>
                  <Badge tone="muted">{TARGET_LABELS[line.target]}</Badge>
                  {line.tripId && <Sub>الرحلة <Open to={`/inventory/${line.tripId}/edit`}>{nameOf(trips, line.tripId, 'voyage')}</Open></Sub>}
                  {line.orderId && <Sub>الطلب <Open to={`/invoice/${line.orderId}/edit`}><Ltr>{nameOf(orders, line.orderId, 'orderId')}</Ltr></Open></Sub>}
                  {line.asset?.name && <Sub>{line.asset.name} · {line.asset.usefulLifeMonths} شهراً</Sub>}
                  {line.prepaid?.months && <Sub>على {line.prepaid.months} شهراً</Sub>}
                </>
              ),
            },
            { key: 'description', header: 'الوصف', render: (line: any) => line.description },
            { key: 'office', header: 'المكتب', hideOnMobile: true, render: (line: any) => OFFICE_LABELS[line.office] || line.office || '-' },
            { key: 'amount', header: 'المبلغ', numeric: true, render: (line: any) => <Amount value={line.amount} currency={bill.currency} /> },
            { key: 'usd', header: 'بالدولار', numeric: true, render: (line: any) => <Money value={line.usd} hideZero strong /> },
          ]}
        />
      </Panel>

      {(payments.length > 0 || creditNotes.length > 0 || entries.length > 0) && (
        <Panel title="مرتبط بهذه الفاتورة">
          {payments.map((p: any) => <div key={p._id} className="mb-1">دفعة <Ltr>{p.number}</Ltr> · <Ltr>{p.day}</Ltr> <StatusBadge status={p.status} /></div>)}
          {creditNotes.map((n: any) => <div key={n._id} className="mb-1">إشعار دائن <RouterLink className="acc-link" to={`/accounting/bills/${n._id}`}>{n.number}</RouterLink> · <Money value={n.totalUsd} /> <StatusBadge status={n.status} /></div>)}
          {entries.map((e: any) => <div key={e._id} className="mb-1">القيد <RouterLink className="acc-link" to={`/accounting/entries/${e._id}`}>{e.number}</RouterLink>{e.status === 'reversed' && <> <Badge tone="muted">أُلغي</Badge></>}</div>)}
        </Panel>
      )}

      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={load} model="AccountingSupplierBill" id={bill._id} title={`الفاتورة ${bill.number}`} />
    </>
  );
};
