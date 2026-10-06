import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { useAccountingAccess } from './useAccountingAccess';
import { EVENT_LABELS, acc, errorText } from './accountingApi';
import { Badge, DataTable, FilterBar, ForeignTotals, Ltr, Money, PageHeader, Panel, ShowCanceled, Sub } from './ui';

const PAGE_SIZE = 50;

const JournalEntries = () => {
  const access = useAccountingAccess();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ from: '', to: '', journalId: '', eventType: '', search: '', accountId: params.get('accountId') || '', showCanceled: '' });
  const [journals, setJournals] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [data, setData] = useState<any>({ results: [], total: 0, page: 1 });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async (page = 1, current = filters) => {
    try {
      setIsLoading(true);
      setError('');
      const query: any = { page, limit: PAGE_SIZE };
      Object.entries(current).forEach(([key, value]) => { if (value) query[key] = value; });
      setData((await acc.get('entries', query)).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    acc.get('journals').then((res: any) => setJournals(res.data.results)).catch(() => {});
    acc.get('entries/event-types').then((res: any) => setEventTypes(res.data.results)).catch(() => {});
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);

  return (
    <>
      <PageHeader
        title="القيود"
        subtitle="القيود لا تُعدَّل ولا تُحذف. الخطأ يُصحَّح بإلغاء القيد (قيد عكسي) ثم تسجيل قيد جديد."
        actions={access.can('entries') ? <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => navigate('/accounting/entries/new')}>قيد يدوي</Button> : undefined}
      />
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <TextField select label="الدفتر" value={filters.journalId} onChange={(e) => setFilters({ ...filters, journalId: e.target.value })} style={{ minWidth: 190 }}>
              <MenuItem value="">كل الدفاتر</MenuItem>
              {journals.map((j) => <MenuItem key={j._id} value={j._id}>{j.name}</MenuItem>)}
            </TextField>
            <TextField select label="نوع العملية" value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value })} style={{ minWidth: 170 }}>
              <MenuItem value="">كل الأنواع</MenuItem>
              {eventTypes.map((type) => <MenuItem key={type} value={type}>{EVENT_LABELS[type] || type}</MenuItem>)}
            </TextField>
            <TextField placeholder="رقم القيد أو البيان" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load(1)} />
            <Button variant="outlined" onClick={() => load(1)} disabled={isLoading}>بحث</Button>
            {filters.accountId && <Chip label="حساب واحد فقط" onDelete={() => { const next = { ...filters, accountId: '' }; setFilters(next); load(1, next); }} />}
            <ShowCanceled checked={filters.showCanceled === 'true'} onChange={(value) => { const next = { ...filters, showCanceled: value ? 'true' : '' }; setFilters(next); load(1, next); }} />
        </FilterBar>
        </div>
        {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
        <DataTable
          loading={isLoading}
          rows={data.results}
          rowKey={(row: any) => row._id}
          onRowClick={(row: any) => navigate(`/accounting/entries/${row._id}`)}
          rowTone={(row: any) => (row.status === 'reversed' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد قيود', hint: 'القيود تظهر هنا عند ترحيل أي عملية من قسم المحاسبة أو من المنظومة.' }}
          columns={[
            { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr>, width: 110 },
            { key: 'number', header: 'رقم القيد', render: (row: any) => <Ltr>{row.number}</Ltr>, hideOnMobile: true },
            {
              key: 'description', header: 'البيان', render: (row: any) => (
                <>
                  <div>{row.description}</div>
                  <Sub>
                    {EVENT_LABELS[row.eventType] || row.eventType}
                    {row.isHistorical && <Badge tone="info">تاريخي</Badge>}
                    {row.reversalOf && <> · <Badge tone="warn">قيد عكسي</Badge></>}
                    {row.status === 'reversed' && <> · <Badge tone="muted">أُلغي</Badge></>}
                  </Sub>
                </>
              ),
            },
            { key: 'foreign', header: 'بالعملة', numeric: true, hideOnMobile: true, render: (row: any) => <ForeignTotals lines={row.lines} /> },
            { key: 'amount', header: 'بالدولار', numeric: true, render: (row: any) => <Money value={row.totalDebit} strong /> },
          ]}
        />
        {pages > 1 && (
          <div className="d-flex justify-content-between align-items-center px-3 py-2">
            <span className="acc-muted">{data.total} قيداً · صفحة {data.page} من {pages}</span>
            <div className="d-flex gap-2">
              <Button size="small" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>السابق</Button>
              <Button size="small" disabled={data.page >= pages} onClick={() => load(data.page + 1)}>التالي</Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
};

export default JournalEntries;
