import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, MenuItem, Pagination, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText } from './accountingApi';
import { SHIPPING_TYPES } from './shared';
import { Badge, DataTable, FilterBar, Money, Open, PageHeader, Panel, StatusBadge, Sub } from './ui';
import TripCostSettlement from './TripCostSettlement';

const COUNTRIES: Record<string, string> = { CN: 'الصين', UAE: 'الإمارات', TR: 'تركيا', USA: 'أمريكا', UK: 'بريطانيا', LY: 'ليبيا' };
const EMPTY_FILTERS = { status: '', country: '', shippingType: '', seaLoadType: '', office: '', arrival: '', cost: '' };
const PAGE_SIZE = 25;

// Trips (never warehouses) with the costs entered on them; each cost is a vendor bill line
const TripCosts = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [resultCount, setResultCount] = useState(0);
  const requestId = useRef(0);
  const [search, setSearch] = useState('');
  const [trips, setTrips] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const invalidateRequest = useCallback(() => { requestId.current++; }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      setIsLoading(true);
      setError('');
      const data = (await acc.get('trips', { ...filters, search: search.trim() || undefined, page, limit: PAGE_SIZE })).data;
      if (id !== requestId.current) return;
      setTrips(data.results);
      setResultCount(data.total ?? data.results.length);
    } catch (err) {
      if (id === requestId.current) setError(errorText(err));
    }
    if (id === requestId.current) setIsLoading(false);
  }, [filters, search, page]);
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(load, 250);
    return () => { clearTimeout(timer); invalidateRequest(); };
  }, [load, invalidateRequest]);

  const changeFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters(current => ({ ...current, [key]: value, ...(key === 'shippingType' && value !== 'sea' ? { seaLoadType: '' } : {}) }));
    setPage(1);
  };

  const total = trips.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  return (
    <>
      <PageHeader
        title="تكاليف الرحلات"
        subtitle="التكاليف تنتظر «قيد التنفيذ» على الرحلة، وتنتقل للتكلفة طرداً طرداً عند الاعتراف بإيراده. المخازن ليست رحلات ولا تُحمَّل عليها تكاليف."
      />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      <Button variant="contained" className="mb-3" onClick={() => setSettlementOpen(true)}>تسوية تكاليف الرحلات جماعيًا</Button>
      <TripCostSettlement open={settlementOpen} onClose={() => setSettlementOpen(false)} onDone={load} />
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField select label="الحالة" value={filters.status} onChange={(e) => changeFilter('status', e.target.value)} style={{ minWidth: 140 }}>
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="processing">مفتوحة</MenuItem>
              <MenuItem value="finished">مكتملة</MenuItem>
            </TextField>
            <TextField select label="بلد الشحن" value={filters.country} onChange={e => changeFilter('country', e.target.value)} style={{ minWidth: 140 }}>
              <MenuItem value="">كل الدول</MenuItem>{Object.entries(COUNTRIES).map(([code, name]) => <MenuItem key={code} value={code}>{name}</MenuItem>)}
            </TextField>
            <TextField select label="نوع الشحن" value={filters.shippingType} onChange={e => changeFilter('shippingType', e.target.value)} style={{ minWidth: 140 }}>
              <MenuItem value="">كل الأنواع</MenuItem>{Object.entries(SHIPPING_TYPES).map(([code, name]) => <MenuItem key={code} value={code}>{name}</MenuItem>)}
            </TextField>
            <TextField select label="الشحن البحري" value={filters.seaLoadType} disabled={!!filters.shippingType && filters.shippingType !== 'sea'} onChange={e => changeFilter('seaLoadType', e.target.value)} style={{ minWidth: 185 }}>
              <MenuItem value="">الكل</MenuItem><MenuItem value="FCL">FCL — حاوية كاملة</MenuItem><MenuItem value="LCL">LCL — شحن مجمّع</MenuItem><MenuItem value="unknown">بحري غير محدد</MenuItem>
            </TextField>
            <TextField select label="المكتب" value={filters.office} onChange={e => changeFilter('office', e.target.value)} style={{ minWidth: 140 }}>
              <MenuItem value="">كل المكاتب</MenuItem>{Object.entries(OFFICE_LABELS).map(([code, name]) => <MenuItem key={code} value={code}>{name}</MenuItem>)}
            </TextField>
            <TextField select label="الوصول" value={filters.arrival} onChange={e => changeFilter('arrival', e.target.value)} style={{ minWidth: 160 }}>
              <MenuItem value="">الكل</MenuItem><MenuItem value="arrived">لها تاريخ وصول</MenuItem><MenuItem value="not_arrived">بدون تاريخ وصول</MenuItem>
            </TextField>
            <TextField select label="التكلفة" value={filters.cost} onChange={e => changeFilter('cost', e.target.value)} style={{ minWidth: 180 }}>
              <MenuItem value="">كل التكاليف</MenuItem><MenuItem value="with_cost">لها تكلفة مسجلة</MenuItem><MenuItem value="without_cost">بدون تكلفة مسجلة</MenuItem><MenuItem value="in_progress">تكلفة قيد التنفيذ</MenuItem>
            </TextField>
            <TextField label="بحث باسم الرحلة" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <Button variant="outlined" onClick={load}>تحديث</Button>
            <Button disabled={!search && !Object.values(filters).some(Boolean)} onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); setPage(1); }}>مسح الفلاتر</Button>
          </FilterBar>
          <Sub>{isLoading ? 'جارٍ تحميل النتائج…' : `${resultCount} رحلة مطابقة للفلاتر — الإجمالي أدناه للصفحة الحالية`}</Sub>
        </div>
        <DataTable
          loading={isLoading}
          rows={trips}
          rowKey={(row: any) => row._id}
          empty={{ title: 'لا توجد رحلات' }}
          columns={[
            {
              key: 'voyage', header: 'الرحلة', sortValue: (row: any) => row.voyage, render: (row: any) => (
                <>
                  <Open to={`/inventory/${row._id}/edit`}>{row.voyage}</Open>
                  <Sub>{row.arrivalDate ? `وصلت ${String(row.arrivalDate).slice(0, 10)}` : 'لم يُحدد تاريخ الوصول'}</Sub>
                </>
              ),
            },
            { key: 'country', header: 'بلد الشحن', render: (row: any) => COUNTRIES[row.shippedCountry] || row.shippedCountry },
            { key: 'type', header: 'النوع', render: (row: any) => <><Badge tone={row.shippingType === 'domestic' ? 'muted' : 'info'}>{SHIPPING_TYPES[row.shippingType] || row.shippingType}</Badge>{row.shippingType === 'sea' && <Sub>{row.seaLoadType || 'FCL/LCL غير محدد'}</Sub>}</> },
            { key: 'office', header: 'المكتب', hideOnMobile: true, render: (row: any) => OFFICE_LABELS[row.inventoryPlace] || row.inventoryPlace },
            { key: 'weight', header: 'وزن / حجم الرحلة', numeric: true, render: (row: any) => {
              const kg = Number(row.totalKG || 0);
              const cbm = Number(row.totalCBM || 0);
              const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 3 });
              return <>{(kg !== 0 || (cbm === 0 && row.shippingType !== 'sea')) && <span dir="ltr">{format(kg)} KG</span>}{cbm !== 0 || row.shippingType === 'sea' ? <Sub><span dir="ltr">{format(cbm)} CBM</span></Sub> : null}</>;
            } },
            { key: 'status', header: 'الحالة', hideOnMobile: true, render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'wip', header: 'قيد التنفيذ', numeric: true, render: (row: any) => <Money value={row.costInProgress} />, sortValue: (row: any) => row.costInProgress },
            { key: 'recognized', header: 'حُمِّل على الطرود', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.costRecognized} /> },
            { key: 'total', header: 'إجمالي التكلفة', numeric: true, render: (row: any) => <Money value={row.totalCost} strong />, sortValue: (row: any) => row.totalCost },
            {
              key: 'actions', header: '', align: 'end', render: (row: any) => (
                <span className="d-inline-flex gap-1">
                  <Button size="small" onClick={() => navigate(`/accounting/bills?tripId=${row._id}`)}>الفواتير</Button>
                  <Button size="small" variant="outlined" onClick={() => navigate(`/accounting/bills/new?tripId=${row._id}`)}>إضافة مصروف</Button>
                </span>
              ),
            },
          ]}
          footer={trips.length ? { voyage: 'إجمالي الصفحة', total: <Money value={total} strong /> } : undefined}
        />
        {resultCount > PAGE_SIZE && <div className="p-3 d-flex justify-content-center"><Pagination count={Math.ceil(resultCount / PAGE_SIZE)} page={page} onChange={(_, value) => setPage(value)} disabled={isLoading} /></div>}
      </Panel>
    </>
  );
};

export default TripCosts;
