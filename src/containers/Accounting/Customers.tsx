import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText } from './accountingApi';
import { useAccountingData } from './useAccountingData';
import { userLabel } from './shared';
import { CustomerAccounting, OrderAccounting } from './AccountingPanels';
import { Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

// The sales side of the books: customers (what they owe, what their wallets hold) and their
// invoices (the orders: billed, paid, open, revenue, cost and profit). Everything is read from the
// ledger; the order and customer pages of the system stay where they are and open in a new tab.

const customerName = (row: any) => (row.customer ? userLabel(row.customer) : row.customerName || 'عميل غير معروف');

function useList(path: string, initial: Record<string, any>) {
  const [filters, setFilters] = useState(initial);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const load = async (next = filters) => {
    try {
      setIsLoading(true);
      setError('');
      const params = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== '' && value !== undefined));
      setData((await acc.get(path, params)).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [path]);
  const change = (patch: Record<string, any>, now = false) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (now) load(next);
  };
  return { filters, change, data, error, isLoading, load };
}

// ---------- Customers ----------

export const CustomersList = () => {
  const navigate = useNavigate();
  const { filters, change, data, error, isLoading, load } = useList('customers', { search: '', view: 'all' });
  const totals = data?.totals;
  return (
    <>
      <PageHeader title="العملاء" subtitle="كل عميل له حركة في الدفاتر: ما عليه من ذمم، وما في محفظتيه بالدولار والدينار ومطابقتها لرصيد المنظومة." />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {totals && (
        <StatGrid>
          <Stat label="على العملاء (ذمم)" value={<Money value={totals.owed} />} tone={totals.owed > 0 ? 'warn' : undefined} hint={`${totals.customers} عميلاً`} />
          <Stat label="في محافظهم بالدولار" value={<Money value={totals.walletUsd} />} hint="مستحق لهم على الشركة" />
          <Stat label="في محافظهم بالدينار" value={<Money value={totals.walletLyd} currency="LYD" />} />
          <Stat label="محافظ لا تطابق المنظومة" value={totals.mismatches} tone={totals.mismatches ? 'danger' : undefined} hint={totals.mismatches ? 'اعرضها من «عرض»' : 'كلها مطابقة'} />
        </StatGrid>
      )}
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField placeholder="الاسم أو رقم العميل أو الهاتف" value={filters.search} onChange={(e) => change({ search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ minWidth: 260 }} />
            <TextField select label="عرض" value={filters.view} onChange={(e) => change({ view: e.target.value }, true)} style={{ minWidth: 200 }}>
              <MenuItem value="all">كل العملاء</MenuItem>
              <MenuItem value="owing">عليهم ذمم</MenuItem>
              <MenuItem value="wallet">في محافظهم رصيد</MenuItem>
              <MenuItem value="mismatch">المحفظة لا تطابق المنظومة</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={() => load()}>بحث</Button>
          </FilterBar>
        </div>
        <DataTable
          dense loading={isLoading} rows={data?.results || []} rowKey={(row: any) => String(row.partnerId)} maxHeight="65vh"
          onRowClick={(row: any) => navigate(`/accounting/customers/${row.partnerId}`)}
          empty={{ title: 'لا عملاء', hint: filters.search ? 'لا أحد بهذا البحث.' : 'تظهر حركات العملاء بعد اعتماد الترحيل التاريخي.' }}
          columns={[
            { key: 'customer', header: 'العميل', sortValue: (row: any) => customerName(row), render: (row: any) => <>{customerName(row)}{row.customer?.phone && <Sub><Ltr>{row.customer.phone}</Ltr></Sub>}</> },
            { key: 'owed', header: 'عليه', numeric: true, sortValue: (row: any) => row.owed, render: (row: any) => <Money value={row.owed} strong={row.owed > 0} hideZero /> },
            { key: 'walletUsd', header: 'محفظة $', numeric: true, sortValue: (row: any) => row.walletUsd, render: (row: any) => <Money value={row.walletUsd} hideZero /> },
            { key: 'walletLyd', header: 'محفظة د.ل', numeric: true, sortValue: (row: any) => row.walletLyd, render: (row: any) => <Money value={row.walletLyd} currency="LYD" hideZero /> },
            { key: 'matches', header: 'المنظومة', render: (row: any) => (row.matches ? <Badge tone="ok">مطابقة</Badge> : <Badge tone="danger">مختلفة</Badge>) },
            { key: 'lastDay', header: 'آخر حركة', hideOnMobile: true, sortValue: (row: any) => row.lastDay || '', render: (row: any) => (row.lastDay ? <><Ltr>{row.lastDay}</Ltr><Sub>{row.movements} حركة</Sub></> : <span className="acc-sub">لا حركات</span>) },
          ]}
          footer={totals ? { customer: data.truncated ? `يُعرض أول ${data.results.length} من ${totals.customers}` : 'الإجمالي', owed: <Money value={totals.owed} strong />, walletUsd: <Money value={totals.walletUsd} strong />, walletLyd: <Money value={totals.walletLyd} currency="LYD" strong /> } : undefined}
        />
      </Panel>
    </>
  );
};

export const CustomerPage = () => {
  const { id } = useParams();
  return (
    <>
      <PageHeader
        title="العميل"
        actions={<div className="d-flex gap-3 flex-wrap"><Open to={`/user/${id}`}>صفحة العميل في المنظومة</Open><Open to={`/accounting/reports?tab=customer&customer=${id}`}>الكشف الكامل والتصدير</Open></div>}
      />
      <CustomerAccounting customerId={id} />
      <InvoicesTable userId={id} title="فواتير العميل" />
    </>
  );
};

// ---------- Customer invoices ----------

const KIND_LABEL: Record<string, string> = { purchase: 'فاتورة شراء', shipment: 'شحن' };
const STATUS: Record<string, { text: string, tone: any }> = {
  paid: { text: 'مسددة', tone: 'ok' }, partial: { text: 'مسددة جزئياً', tone: 'warn' }, unpaid: { text: 'غير مسددة', tone: 'danger' },
  none: { text: 'لا قيود بعد', tone: 'muted' }, canceled: { text: 'ملغاة', tone: 'muted' },
  deleted: { text: 'محذوفة', tone: 'muted' },
};

const InvoicesTable = ({ userId, title }: { userId?: string, title?: string }) => {
  const navigate = useNavigate();
  const { offices } = useAccountingData();
  const { filters, change, data, error, isLoading, load } = useList('customer-invoices', { search: '', kind: '', status: '', office: '', from: '', to: '', userId: userId || '' });
  const totals = data?.totals;
  return (
    <>
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {totals && !userId && (
        <StatGrid>
          <Stat label="مطالبات على العملاء" value={<Money value={totals.billed} />} hint={`${totals.count} فاتورة`} />
          <Stat label="المسدد" value={<Money value={totals.paid} />} />
          <Stat label="المتبقي" value={<Money value={totals.open} />} tone={totals.open > 0 ? 'warn' : undefined} />
          <Stat label="إيراد معترف به" value={<Money value={totals.recognized} />} hint={<>مؤجل <Money value={totals.deferred} /></>} />
          <Stat label="الربح" value={<Money value={totals.profit} />} tone={totals.profit < 0 ? 'danger' : 'accent'} hint={<>التكلفة <Money value={totals.cost} /></>} />
        </StatGrid>
      )}
      <Panel flush title={title}>
        <div className="px-3">
          <FilterBar>
            {!userId && <TextField placeholder="رقم الطلب أو اسم العميل أو رقمه" value={filters.search} onChange={(e) => change({ search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ minWidth: 240 }} />}
            <TextField select label="النوع" value={filters.kind} onChange={(e) => change({ kind: e.target.value }, true)} style={{ minWidth: 140 }}>
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="purchase">فواتير شراء</MenuItem>
              <MenuItem value="shipment">شحن فقط</MenuItem>
            </TextField>
            <TextField select label="الحالة" value={filters.status} onChange={(e) => change({ status: e.target.value }, true)} style={{ minWidth: 150 }}>
              <MenuItem value="">الكل</MenuItem>
              {Object.entries(STATUS).map(([key, { text }]) => <MenuItem key={key} value={key}>{text}</MenuItem>)}
            </TextField>
            {!userId && (
              <TextField select label="المكتب" value={filters.office} onChange={(e) => change({ office: e.target.value }, true)} style={{ minWidth: 130 }}>
                <MenuItem value="">الكل</MenuItem>
                {offices.map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
              </TextField>
            )}
            <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => change({ from: e.target.value })} />
            <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => change({ to: e.target.value })} />
            <Button variant="outlined" onClick={() => load()}>عرض</Button>
          </FilterBar>
        </div>
        <DataTable
          dense loading={isLoading} rows={data?.results || []} rowKey={(row: any) => row._id} maxHeight="65vh"
          onRowClick={(row: any) => navigate(`/accounting/customer-invoices/${row._id}`)}
          rowTone={(row: any) => (row.status === 'canceled' || row.status === 'deleted' ? 'canceled' : undefined)}
          empty={{ title: 'لا فواتير بهذا البحث' }}
          columns={[
            {
              key: 'order', header: 'الفاتورة', sortValue: (row: any) => row.orderNumber, render: (row: any) => (
                <>
                  <Ltr>{row.orderNumber}</Ltr> <Badge tone={row.kind === 'purchase' ? 'info' : 'muted'}>{KIND_LABEL[row.kind]}</Badge>
                  <Sub><Ltr>{String(row.date).slice(0, 10)}</Ltr> · {OFFICE_LABELS[row.office] || row.office}</Sub>
                </>
              ),
            },
            ...(userId ? [] : [{ key: 'customer', header: 'العميل', sortValue: (row: any) => customerName(row), render: (row: any) => customerName(row) }]),
            { key: 'billed', header: 'المطالبة', numeric: true, sortValue: (row: any) => row.billed, render: (row: any) => <Money value={row.billed} hideZero /> },
            { key: 'paid', header: 'المسدد', numeric: true, hideOnMobile: true, sortValue: (row: any) => row.paid, render: (row: any) => <Money value={row.paid} tone="plain" hideZero /> },
            { key: 'open', header: 'المتبقي', numeric: true, sortValue: (row: any) => row.open, render: (row: any) => <Money value={row.open} strong={row.open > 0} hideZero /> },
            { key: 'cost', header: 'التكلفة', numeric: true, hideOnMobile: true, sortValue: (row: any) => row.cost + row.costInProgress, render: (row: any) => <><Money value={row.cost} tone="plain" hideZero />{row.costInProgress > 0 && <Sub>قيد التنفيذ <Money value={row.costInProgress} tone="plain" /></Sub>}</> },
            { key: 'profit', header: 'الربح', numeric: true, sortValue: (row: any) => row.profit, render: (row: any) => (row.recognized ? <Money value={row.profit} strong /> : row.deferred ? <Badge tone="warn">مؤجل</Badge> : null) },
            { key: 'status', header: 'الحالة', render: (row: any) => <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].text}</Badge> },
          ]}
          footer={totals && totals.count ? { order: data.truncated ? `يُعرض ${data.results.length} من ${totals.count}` : `${totals.count} فاتورة`, billed: <Money value={totals.billed} strong />, paid: <Money value={totals.paid} strong />, open: <Money value={totals.open} strong />, cost: <Money value={totals.cost} strong />, profit: <Money value={totals.profit} strong /> } : undefined}
        />
      </Panel>
    </>
  );
};

export const CustomerInvoicesList = () => (
  <>
    <PageHeader title="فواتير العملاء" subtitle="الطلبات كما في الدفاتر: ما طُولب به العميل وما سدده وما بقي، والإيراد المعترف به أو المؤجل، والتكلفة والربح." />
    <InvoicesTable />
  </>
);

export const CustomerInvoicePage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  useEffect(() => {
    acc.get(`summary/order/${id}`).then((res: any) => setOrder(res.data.order)).catch(() => {});
  }, [id]);
  return (
    <>
      <PageHeader
        title={<>فاتورة العميل {order && <Ltr>{order.orderId}</Ltr>}</>}
        subtitle={order?.isDeleted ? 'الطلب محذوف من المنظومة (أُنشئ بالخطأ)؛ عُكست مطالباته.' : order?.isCanceled ? 'الطلب ملغى.' : undefined}
        actions={<div className="d-flex gap-3 flex-wrap">
          {!order?.isDeleted && <Open to={`/invoice/${id}/edit`}>الطلب في المنظومة</Open>}
          {order?.user && <Open to={`/accounting/customers/${order.user}`}>حساب العميل</Open>}
        </div>}
      />
      <OrderAccounting orderId={id} orderNumber={order?.orderId} />
    </>
  );
};
