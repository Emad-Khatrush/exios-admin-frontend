import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import moment from 'moment';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { Building2, CalendarClock, Download, FileSpreadsheet, Megaphone, Package, Phone, Receipt, Search, UserRound } from 'lucide-react';
import api from '../../api';

type ValueTier = 'high' | 'middle' | 'normal';

type InactiveCustomer = {
  _id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  lastActivityAt: string;
  activityCount: number;
  customerSince: string | null;
  // invoices report
  totalOrders?: number;
  totalSpent?: number;
  // shipments report
  totalKG?: number;
  totalCBM?: number;
  packagesCount?: number;
  valueTier?: ValueTier;
};

type SearchedFor = { type: 'invoices' | 'shipments'; months: number };

const TYPES = [
  { value: 'invoices', label: 'Invoices', icon: Receipt },
  { value: 'shipments', label: 'Shipments', icon: Package },
] as const;

const TIER_LABELS: Record<ValueTier, string> = {
  high: 'High value',
  middle: 'Middle value',
  normal: 'Normal',
};

const fullName = (person: InactiveCustomer) => [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Unknown';
const formatMoney = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatWeight = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

const buildFilename = (searchedFor: SearchedFor) =>
  `Exios_Inactive_${searchedFor.type}_${searchedFor.months}m_${moment().format('YYYY-MM-DD')}`;

const exportToExcel = (results: InactiveCustomer[], searchedFor: SearchedFor) => {
  const isShipments = searchedFor.type === 'shipments';

  const rows = results.map((customer) => ({
    'Customer ID': customer.customerId,
    'Name': fullName(customer),
    'Phone': customer.phone || '',
    'City': customer.city || '',
    [`Last ${isShipments ? 'Shipment' : 'Order'}`]: moment(customer.lastActivityAt).format('DD/MM/YYYY'),
    ...(isShipments
      ? {
        'Total KG': customer.totalKG || 0,
        'Total CBM': customer.totalCBM || 0,
        'Packages': customer.packagesCount || 0,
        'Value Tier': customer.valueTier ? TIER_LABELS[customer.valueTier] : '',
      }
      : {
        'Total Orders': customer.totalOrders || 0,
        'Total Spent': customer.totalSpent || 0,
      }),
    'Customer Since': customer.customerSince ? moment(customer.customerSince).format('DD/MM/YYYY') : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inactive customers');
  XLSX.writeFile(workbook, `${buildFilename(searchedFor)}.xlsx`);
};

const exportToPDF = (results: InactiveCustomer[], searchedFor: SearchedFor) => {
  const isShipments = searchedFor.type === 'shipments';
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const marginBottom = 16;

  const columns = isShipments
    ? [
      { header: 'Customer ID', key: 'customerId', width: 28 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Phone', key: 'phone', width: 30 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'Last shipment', key: 'lastActivity', width: 28 },
      { header: 'Total KG', key: 'totalKG', width: 22 },
      { header: 'Total CBM', key: 'totalCBM', width: 22 },
      { header: 'Value tier', key: 'valueTier', width: 28 },
    ]
    : [
      { header: 'Customer ID', key: 'customerId', width: 30 },
      { header: 'Name', key: 'name', width: 45 },
      { header: 'Phone', key: 'phone', width: 32 },
      { header: 'City', key: 'city', width: 22 },
      { header: 'Last order', key: 'lastActivity', width: 30 },
      { header: 'Total orders', key: 'totalOrders', width: 24 },
      { header: 'Total spent', key: 'totalSpent', width: 26 },
      { header: 'Customer since', key: 'customerSince', width: 30 },
    ];

  let y = 20;

  doc.setFontSize(14);
  doc.text('Customers gone quiet', marginX, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(90, 100, 110);
  doc.text(
    `No ${searchedFor.type} in over ${searchedFor.months} month${searchedFor.months === 1 ? '' : 's'} - ${results.length} customer${results.length === 1 ? '' : 's'} - generated ${moment().format('DD MMM YYYY, HH:mm')}`,
    marginX,
    y
  );
  y += 10;

  const drawHeader = () => {
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(29, 78, 216);
    doc.rect(marginX, y - 5, pageWidth - marginX * 2, 8, 'F');
    let x = marginX + 2;
    columns.forEach((column) => {
      doc.text(column.header, x, y);
      x += column.width;
    });
    y += 8;
    doc.setTextColor(24, 33, 43);
  };

  drawHeader();

  results.forEach((customer, index) => {
    if (y > pageHeight - marginBottom) {
      doc.addPage();
      y = 20;
      drawHeader();
    }

    if (index % 2 === 1) {
      doc.setFillColor(246, 247, 249);
      doc.rect(marginX, y - 5, pageWidth - marginX * 2, 7, 'F');
    }

    const row: Record<string, string> = isShipments
      ? {
        customerId: customer.customerId || '',
        name: fullName(customer),
        phone: customer.phone ? String(customer.phone) : '',
        city: customer.city || '',
        lastActivity: moment(customer.lastActivityAt).format('DD/MM/YYYY'),
        totalKG: formatWeight(customer.totalKG || 0),
        totalCBM: formatWeight(customer.totalCBM || 0),
        valueTier: customer.valueTier ? TIER_LABELS[customer.valueTier] : '-',
      }
      : {
        customerId: customer.customerId || '',
        name: fullName(customer),
        phone: customer.phone ? String(customer.phone) : '',
        city: customer.city || '',
        lastActivity: moment(customer.lastActivityAt).format('DD/MM/YYYY'),
        totalOrders: String(customer.totalOrders || 0),
        totalSpent: formatMoney(customer.totalSpent || 0),
        customerSince: customer.customerSince ? moment(customer.customerSince).format('DD/MM/YYYY') : '-',
      };

    let x = marginX + 2;
    columns.forEach((column) => {
      const text = doc.splitTextToSize(row[column.key], column.width - 2)[0] || '';
      doc.text(text, x, y);
      x += column.width;
    });
    y += 7;
  });

  doc.save(`${buildFilename(searchedFor)}.pdf`);
};

const ValueTierBadge = ({ tier }: { tier: ValueTier }) => (
  <span className={`marketing__tier is-${tier}`}>{TIER_LABELS[tier]}</span>
);

const InactiveCustomers = () => {
  const [type, setType] = useState<'invoices' | 'shipments'>('invoices');
  const [months, setMonths] = useState('3');
  const [results, setResults] = useState<InactiveCustomer[] | null>(null);
  const [searchedFor, setSearchedFor] = useState<SearchedFor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const monthsNumber = parseInt(months, 10);
  const canSearch = Number.isFinite(monthsNumber) && monthsNumber >= 1 && !isLoading;
  const canExport = !isLoading && !!results?.length && !!searchedFor;
  const isShipmentsReport = searchedFor?.type === 'shipments';

  const search = async () => {
    if (!canSearch) return;

    try {
      setIsLoading(true);
      setError('');
      const response = await api.get('marketing/inactiveCustomers', { type, months: monthsNumber });
      setResults(response.data.results);
      setSearchedFor({ type, months: monthsNumber });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load inactive customers. Please try again.');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="marketing">
      <header className="marketing__header">
        <div>
          <h5 className="marketing__title">
            <Megaphone size={18} strokeWidth={2} />
            Customers gone quiet
          </h5>
          <p className="marketing__subtitle">
            Find customers who ordered or shipped with us before, but haven't in a while, so you can reach out.
          </p>
        </div>

        <div className="marketing__export">
          <button type="button" disabled={!canExport} onClick={() => results && searchedFor && exportToExcel(results, searchedFor)}>
            <FileSpreadsheet size={15} strokeWidth={2} />
            Export Excel
          </button>
          <button type="button" disabled={!canExport} onClick={() => results && searchedFor && exportToPDF(results, searchedFor)}>
            <Download size={15} strokeWidth={2} />
            Export PDF
          </button>
        </div>
      </header>

      <div className="marketing__filters">
        <div className="marketing__field">
          <span className="marketing__field-label">Look at</span>
          <div className="marketing__segmented" role="tablist" aria-label="Activity type">
            {TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={type === option.value}
                className={type === option.value ? 'is-active' : ''}
                onClick={() => setType(option.value)}
              >
                <option.icon size={14} strokeWidth={2} />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="marketing__field">
          <span className="marketing__field-label">No activity in the last</span>
          <div className="marketing__months">
            <input
              type="number"
              min={1}
              value={months}
              onChange={(event) => setMonths(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && search()}
            />
            <span>month{monthsNumber === 1 ? '' : 's'}</span>
          </div>
        </div>

        <button type="button" className="marketing__search" disabled={!canSearch} onClick={search}>
          <Search size={15} strokeWidth={2} />
          {isLoading ? 'Searching…' : 'Find customers'}
        </button>
      </div>

      {error && <p className="marketing__error" role="alert">{error}</p>}

      {searchedFor && !error && !isLoading &&
        <p className="marketing__count">
          {results?.length || 0} customer{results?.length === 1 ? '' : 's'} with no {searchedFor.type === 'shipments' ? 'shipments' : 'invoices'} in
          over {searchedFor.months} month{searchedFor.months === 1 ? '' : 's'}
        </p>
      }

      {isShipmentsReport &&
        <p className="marketing__tier-key">
          Value tiers: <ValueTierBadge tier="high" /> &gt;50 KG or &gt;5 CBM shipped &nbsp;·&nbsp;
          <ValueTierBadge tier="middle" /> 20-50 KG or 2-5 CBM &nbsp;·&nbsp;
          <ValueTierBadge tier="normal" /> less than that
        </p>
      }

      <div className="marketing__list">
        {isLoading && Array.from({ length: 4 }).map((_, index) => (
          <div key={`skeleton-${index}`} className="marketing__row marketing__row--skeleton">
            <span className="marketing__skeleton-bar" style={{ width: '35%', height: 14 }} />
            <span className="marketing__skeleton-bar" style={{ width: '55%', height: 12 }} />
          </div>
        ))}

        {!isLoading && results?.map((customer) => (
          <article key={customer._id} className="marketing__row">
            <div className="marketing__who">
              <span className="marketing__avatar"><UserRound size={15} strokeWidth={2} /></span>
              <div>
                <RouterLink to={`/user/${customer._id}`} className="marketing__name">
                  {fullName(customer)}
                  <span className="marketing__code">{customer.customerId}</span>
                  {customer.valueTier && <ValueTierBadge tier={customer.valueTier} />}
                </RouterLink>
                <div className="marketing__meta">
                  {customer.phone && <span><Phone size={12} strokeWidth={2} /> {customer.phone}</span>}
                  {customer.city && <span><Building2 size={12} strokeWidth={2} /> {customer.city}</span>}
                  {customer.customerSince && <span>Customer since {moment(customer.customerSince).format('MMM YYYY')}</span>}
                </div>
              </div>
            </div>

            <dl className="marketing__figures">
              {isShipmentsReport ? (
                <>
                  <div><dt>Total KG</dt><dd className="is-strong">{formatWeight(customer.totalKG || 0)}</dd></div>
                  <div><dt>Total CBM</dt><dd>{formatWeight(customer.totalCBM || 0)}</dd></div>
                  <div><dt>Packages</dt><dd>{customer.packagesCount || 0}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Total orders</dt><dd>{customer.totalOrders || 0}</dd></div>
                  <div><dt>Total spent</dt><dd className="is-strong">{formatMoney(customer.totalSpent || 0)}</dd></div>
                </>
              )}
            </dl>

            <div className="marketing__activity">
              <span className="marketing__last">
                <CalendarClock size={13} strokeWidth={2} />
                Last {searchedFor?.type === 'shipments' ? 'shipment' : 'order'} {moment(customer.lastActivityAt).format('DD MMM YYYY')}
              </span>
              <span className="marketing__ago">{moment(customer.lastActivityAt).fromNow()}</span>
            </div>
          </article>
        ))}

        {!isLoading && !error && searchedFor && results?.length === 0 &&
          <div className="marketing__empty">
            <Megaphone size={28} strokeWidth={1.5} />
            <p className="m-0 fw-semibold">Nobody matches this filter</p>
            <p className="m-0">Every client has {searchedFor.type === 'shipments' ? 'shipped' : 'ordered'} within the last {searchedFor.months} month{searchedFor.months === 1 ? '' : 's'}.</p>
          </div>
        }

        {!isLoading && !searchedFor &&
          <div className="marketing__empty">
            <Megaphone size={28} strokeWidth={1.5} />
            <p className="m-0 fw-semibold">Choose a filter and search</p>
            <p className="m-0">Pick invoices or shipments and how many months of silence counts as "gone quiet".</p>
          </div>
        }
      </div>
    </div>
  );
};

export default InactiveCustomers;
