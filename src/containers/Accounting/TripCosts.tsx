import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText } from './accountingApi';
import { SHIPPING_TYPES } from './shared';
import { Badge, DataTable, FilterBar, Money, Open, PageHeader, Panel, StatusBadge, Sub } from './ui';

// Trips (never warehouses) with the costs entered on them; each cost is a vendor bill line
const TripCosts = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [search, setSearch] = useState('');
  const [trips, setTrips] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      setTrips((await acc.get('trips', { status: status || undefined, search: search || undefined, limit: 100 })).data.results);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

  const total = trips.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  return (
    <>
      <PageHeader
        title="تكاليف الرحلات"
        subtitle="التكاليف تنتظر «قيد التنفيذ» على الرحلة، وتنتقل للتكلفة طرداً طرداً عند الاعتراف بإيراده. المخازن ليست رحلات ولا تُحمَّل عليها تكاليف."
      />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField select label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 140 }}>
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="processing">مفتوحة</MenuItem>
              <MenuItem value="finished">مكتملة</MenuItem>
            </TextField>
            <TextField placeholder="اسم الرحلة" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <Button variant="outlined" onClick={load}>بحث</Button>
          </FilterBar>
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
            { key: 'type', header: 'النوع', render: (row: any) => <Badge tone={row.shippingType === 'domestic' ? 'muted' : 'info'}>{SHIPPING_TYPES[row.shippingType] || row.shippingType}</Badge> },
            { key: 'office', header: 'المكتب', hideOnMobile: true, render: (row: any) => OFFICE_LABELS[row.inventoryPlace] || row.inventoryPlace },
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
          footer={trips.length ? { voyage: 'الإجمالي', total: <Money value={total} strong /> } : undefined}
        />
      </Panel>
    </>
  );
};

export default TripCosts;
