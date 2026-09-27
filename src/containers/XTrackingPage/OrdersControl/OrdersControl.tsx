import { useCallback, useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import * as XLSX from 'xlsx';
import {
  ClipboardList, Download, ExternalLink, Info, MessageCircle, PackageSearch, RotateCw, UserRound, X
} from 'lucide-react';
import api from '../../../api';
import {
  AGE_OPTIONS, ControlResponse, ControlRow, formatNumber, ISSUES, issueLabel, METHOD_LABELS, OFFICES,
  officeLabel, SORT_OPTIONS, Stage, STAGES, stageLabel
} from './controlRules';

import './OrdersControl.scss';

type Filters = {
  search: string
  stage: Stage | 'all'
  office: string
  method: string
  orderType: string
  minDays: number
  issue: string
  onlyIssues: boolean
  sort: string
  view: 'packages' | 'customers'
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  stage: 'all',
  office: 'all',
  method: 'all',
  orderType: 'all',
  minDays: 0,
  issue: 'all',
  onlyIssues: false,
  sort: 'daysDesc',
  view: 'packages',
};

const STORAGE_KEY = 'xtracking.ordersControl.filters';
const PAGE_SIZE = 50;

// Filters are remembered per browser; storage can be blocked, so every access is guarded
const loadFilters = (): Filters => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return saved ? { ...DEFAULT_FILTERS, ...saved, search: '' } : DEFAULT_FILTERS;
  } catch (error) {
    return DEFAULT_FILTERS;
  }
};

const saveFilters = (filters: Filters) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, search: '' }));
  } catch (error) {
    // Not important: filters just won't be remembered
  }
};

// Libyan numbers are stored without the country code or leading 0
const whatsappLink = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 7) return '';
  return `https://wa.me/${digits.startsWith('218') ? digits : `218${digits.replace(/^0/, '')}`}`;
};

const matchesSearch = (row: ControlRow, query: string) => {
  if (!query) return true;
  return [row.customerName, row.customerId, row.orderId, row.trackingNumber, row.receiptNo, row.phone, row.voyage?.name]
    .some(value => value && String(value).toLowerCase().includes(query));
};

type CustomerGroup = {
  key: string
  customerName: string
  customerId: string
  customerMongoId: string | null
  phone: string
  packages: number
  ready: number
  readyCost: number
  orders: Set<string>
  oldestDays: number
  issues: number
  offices: Set<string>
}

const OrdersControl = () => {
  const [data, setData] = useState<ControlResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [includeDelivered, setIncludeDelivered] = useState(false);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [page, setPage] = useState(1);

  const load = useCallback(async (withDelivered: boolean) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get(`orders/control?includeDelivered=${withDelivered}&deliveredDays=60`);
      setData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر تحميل بيانات الطلبيات. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(includeDelivered); }, [load, includeDelivered]);
  useEffect(() => { saveFilters(filters); }, [filters]);

  const update = (patch: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(1);
  };

  const rows = useMemo(() => data?.rows || [], [data]);

  // Every filter except the stage, so the stage chips can show how many match each stage
  const baseFiltered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return rows.filter(row =>
      (filters.office === 'all' || row.office === filters.office) &&
      (filters.method === 'all' || row.method === filters.method) &&
      (filters.orderType === 'all' || row.orderType === filters.orderType) &&
      (!filters.minDays || (row.days ?? 0) > filters.minDays) &&
      (filters.issue === 'all' || row.issues.includes(filters.issue)) &&
      (!filters.onlyIssues || row.issues.length > 0) &&
      matchesSearch(row, query)
    );
  }, [rows, filters]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: baseFiltered.length };
    baseFiltered.forEach(row => { counts[row.stage] = (counts[row.stage] || 0) + 1; });
    return counts;
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    const list = filters.stage === 'all' ? baseFiltered : baseFiltered.filter(row => row.stage === filters.stage);
    const sorted = [...list];
    const byDays = (a: ControlRow, b: ControlRow) => (b.days ?? -1) - (a.days ?? -1);
    switch (filters.sort) {
      case 'daysAsc': sorted.sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)); break;
      case 'costDesc': sorted.sort((a, b) => b.shippingCost - a.shippingCost); break;
      case 'issuesDesc': sorted.sort((a, b) => b.issues.length - a.issues.length || byDays(a, b)); break;
      case 'customer': sorted.sort((a, b) => a.customerName.localeCompare(b.customerName, 'ar')); break;
      case 'orderId': sorted.sort((a, b) => String(a.orderId).localeCompare(String(b.orderId), 'en', { numeric: true })); break;
      default: sorted.sort(byDays);
    }
    return sorted;
  }, [baseFiltered, filters.stage, filters.sort]);

  // Whole-business numbers for the tiles (not affected by the filters)
  const summary = useMemo(() => {
    const ready = rows.filter(row => row.stage === 'ready');
    const count = (code: string) => rows.filter(row => row.issues.includes(code)).length;
    return {
      ready: ready.length,
      readyCost: ready.reduce((sum, row) => sum + row.shippingCost, 0),
      readyCustomers: new Set(ready.map(row => row.customerMongoId || row.customerId)).size,
      overdue: count('overduePickup'),
      stuck: count('stuckAbroad'),
      noPrice: count('noPrice'),
      withIssues: rows.filter(row => row.issues.length > 0).length,
      onTheWay: rows.filter(row => row.stage === 'waiting' || row.stage === 'abroad').length,
    };
  }, [rows]);

  const issueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(row => row.issues.forEach(code => { counts[code] = (counts[code] || 0) + 1; }));
    return counts;
  }, [rows]);

  const customers = useMemo(() => {
    const groups = new Map<string, CustomerGroup>();
    filtered.forEach(row => {
      const key = String(row.customerMongoId || row.customerId || row.customerName);
      if (!groups.has(key)) {
        groups.set(key, {
          key, customerName: row.customerName, customerId: row.customerId, customerMongoId: row.customerMongoId,
          phone: row.phone, packages: 0, ready: 0, readyCost: 0, orders: new Set(), oldestDays: 0, issues: 0, offices: new Set(),
        });
      }
      const group = groups.get(key)!;
      group.packages++;
      group.orders.add(row.orderId);
      if (row.office) group.offices.add(row.office);
      if (row.stage === 'ready') { group.ready++; group.readyCost += row.shippingCost; }
      group.oldestDays = Math.max(group.oldestDays, row.days ?? 0);
      if (row.issues.length > 0) group.issues++;
    });
    const list = Array.from(groups.values());
    list.sort((a, b) => filters.sort === 'costDesc' ? b.readyCost - a.readyCost
      : filters.sort === 'customer' ? a.customerName.localeCompare(b.customerName, 'ar')
      : filters.sort === 'issuesDesc' ? b.issues - a.issues
      : b.oldestDays - a.oldestDays);
    return list;
  }, [filtered, filters.sort]);

  const isCustomerView = filters.view === 'customers';
  const totalItems = isCustomerView ? customers.length : filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageCustomers = customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filteredCost = filtered.reduce((sum, row) => sum + (row.stage === 'ready' ? row.shippingCost : 0), 0);

  const activeFilterChips = [
    filters.search.trim() && { label: `بحث: ${filters.search.trim()}`, clear: { search: '' } },
    filters.office !== 'all' && { label: `مكتب ${officeLabel(filters.office)}`, clear: { office: 'all' } },
    filters.method !== 'all' && { label: METHOD_LABELS[filters.method], clear: { method: 'all' } },
    filters.orderType !== 'all' && { label: filters.orderType === 'purchase' ? 'طلبيات شراء' : 'طلبيات شحن فقط', clear: { orderType: 'all' } },
    filters.minDays > 0 && { label: `أكثر من ${filters.minDays} يوم`, clear: { minDays: 0 } },
    filters.issue !== 'all' && { label: issueLabel(filters.issue), clear: { issue: 'all' } },
    filters.onlyIssues && { label: 'بها مشاكل فقط', clear: { onlyIssues: false } },
  ].filter(Boolean) as { label: string, clear: Partial<Filters> }[];

  const exportExcel = () => {
    const header = ['رقم الطلبية', 'الزبون', 'رمز العميل', 'الهاتف', 'المكتب', 'نوع الطلبية', 'الشحن', 'المرحلة', 'عدد الأيام',
      'رقم التتبع', 'رقم الإيصال', 'الوزن', 'الوحدة', 'سعر الشحن $', 'قيمة الشحن $', 'المخزن', 'الرحلة', 'المشاكل'];
    const body = filtered.map(row => [
      row.orderId, row.customerName, row.customerId, row.phone, officeLabel(row.office),
      row.orderType === 'purchase' ? 'شراء' : 'شحن', METHOD_LABELS[row.method] || row.method, stageLabel(row.stage), row.days ?? '',
      row.trackingNumber || '', row.receiptNo || '', row.weight || '', row.unit || '', row.exiosPrice || '', row.shippingCost || '',
      officeLabel(row.warehouse), row.voyage?.name || '', row.issues.map(issueLabel).join('، '),
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet['!cols'] = header.map((_, i) => ({ wch: [12, 24, 10, 14].includes(i) ? 22 : 14 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'مراقبة الطلبيات');
    XLSX.writeFile(book, `مراقبة الطلبيات ${moment().format('DD-MM-YYYY')}.xlsx`);
  };

  const tile = (label: string, value: number, note: string, tone: string, onClick: () => void, active: boolean) => (
    <button type="button" className={`oc-tile ${tone} ${active ? 'is-active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <small>{note}</small>
    </button>
  );

  const pickupDays = data?.rules?.pickupDays;

  return (
    <div className="oc" dir="rtl" lang="ar">
      <header className="oc-head">
        <div>
          <h1>مراقبة الطلبيات</h1>
          <p>كل طرد في الطلبيات المفتوحة، أين هو، منذ متى، وما الذي يحتاج مراجعة.</p>
        </div>
        <div className="oc-head-actions">
          {data?.generatedAt && <span>آخر تحديث {moment(data.generatedAt).format('HH:mm')}</span>}
          <button type="button" className="oc-btn" onClick={() => load(includeDelivered)} disabled={isLoading}>
            <RotateCw size={15} strokeWidth={2} />
            تحديث
          </button>
          <button type="button" className="oc-btn is-primary" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download size={15} strokeWidth={2} />
            تصدير Excel
          </button>
        </div>
      </header>

      {error &&
        <div className="oc-note is-error" role="alert">
          <span>{error}</span>
          <button type="button" className="oc-btn is-small" onClick={() => load(includeDelivered)}>إعادة المحاولة</button>
        </div>
      }

      <section className="oc-tiles" aria-label="ملخص">
        {tile('جاهزة للتسليم', summary.ready, `${formatNumber(summary.readyCost)}$ شحن مستحق، ${summary.readyCustomers} زبون`, 'is-warn',
          () => update({ stage: filters.stage === 'ready' && filters.issue === 'all' ? 'all' : 'ready', issue: 'all' }),
          filters.stage === 'ready' && filters.issue === 'all')}
        {tile('متأخرة عن الاستلام', summary.overdue, pickupDays ? `أكثر من ${pickupDays.air} يوم جوي / ${pickupDays.sea} بحري` : 'تجاوزت مدة الاستلام', 'is-danger',
          () => update({ issue: filters.issue === 'overduePickup' ? 'all' : 'overduePickup', stage: 'all' }), filters.issue === 'overduePickup')}
        {tile('عالقة في الخارج', summary.stuck, 'في مخزن الخارج منذ مدة طويلة', 'is-danger',
          () => update({ issue: filters.issue === 'stuckAbroad' ? 'all' : 'stuckAbroad', stage: 'all' }), filters.issue === 'stuckAbroad')}
        {tile('بدون سعر أو وزن', summary.noPrice, 'لا يمكن احتساب قيمة الشحن', 'is-danger',
          () => update({ issue: filters.issue === 'noPrice' ? 'all' : 'noPrice', stage: 'all' }), filters.issue === 'noPrice')}
        {tile('تحتاج مراجعة', summary.withIssues, 'طرود وطلبيات فيها ملاحظة واحدة على الأقل', '',
          () => update({ onlyIssues: !filters.onlyIssues, issue: 'all' }), filters.onlyIssues && filters.issue === 'all')}
        {tile('في الطريق', summary.onTheWay, 'لم تصل ليبيا بعد', 'is-ok',
          () => update({ stage: filters.stage === 'abroad' ? 'all' : 'abroad', issue: 'all' }), filters.stage === 'abroad')}
      </section>

      <details className="oc-guide">
        <summary>
          <Info size={16} strokeWidth={2} />
          كيف تعمل الفحوصات التلقائية؟
        </summary>
        <dl>
          {Object.entries(ISSUES).map(([code, issue]) => (
            <div key={code}>
              <dt><span className={`oc-issue is-${issue.tone}`}>{issue.label}</span> <small className="oc-ok-mark">({issueCounts[code] || 0})</small></dt>
              <dd>{issue.description}</dd>
            </div>
          ))}
        </dl>
      </details>

      <section className="oc-panel" aria-label="الفلاتر">
        <div className="oc-stages" role="group" aria-label="المرحلة">
          <button type="button" aria-pressed={filters.stage === 'all'} onClick={() => update({ stage: 'all' })}>
            الكل <em>{stageCounts.all || 0}</em>
          </button>
          {STAGES.filter(stage => stage.value !== 'delivered' || includeDelivered).map(stage => (
            <button
              key={stage.value}
              type="button"
              title={stage.hint}
              aria-pressed={filters.stage === stage.value}
              onClick={() => update({ stage: stage.value })}
            >
              {stage.label} <em>{stageCounts[stage.value] || 0}</em>
            </button>
          ))}
        </div>

        <div className="oc-filters">
          <label className="oc-field">
            <span>بحث</span>
            <input
              type="search"
              value={filters.search}
              placeholder="الاسم، رمز العميل، رقم الطلبية، التتبع، الهاتف أو الرحلة"
              onChange={(event) => update({ search: event.target.value })}
            />
          </label>
          <label className="oc-field">
            <span>المكتب</span>
            <select value={filters.office} onChange={(event) => update({ office: event.target.value })}>
              <option value="all">كل المكاتب</option>
              {OFFICES.map(office => <option key={office.value} value={office.value}>{office.label}</option>)}
            </select>
          </label>
          <label className="oc-field">
            <span>طريقة الشحن</span>
            <select value={filters.method} onChange={(event) => update({ method: event.target.value })}>
              <option value="all">الكل</option>
              <option value="air">جوي</option>
              <option value="sea">بحري</option>
            </select>
          </label>
          <label className="oc-field">
            <span>نوع الطلبية</span>
            <select value={filters.orderType} onChange={(event) => update({ orderType: event.target.value })}>
              <option value="all">الكل</option>
              <option value="shipment">شحن فقط</option>
              <option value="purchase">شراء وشحن</option>
            </select>
          </label>
          <label className="oc-field">
            <span>مدة الانتظار</span>
            <select value={filters.minDays} onChange={(event) => update({ minDays: Number(event.target.value) })}>
              {AGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="oc-field">
            <span>المشكلة</span>
            <select value={filters.issue} onChange={(event) => update({ issue: event.target.value })}>
              <option value="all">كل الحالات</option>
              {Object.entries(ISSUES).map(([code, issue]) => (
                <option key={code} value={code}>{issue.label} ({issueCounts[code] || 0})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="oc-toggles">
          <label>
            <input type="checkbox" checked={filters.onlyIssues} onChange={(event) => update({ onlyIssues: event.target.checked })} />
            إظهار ما فيه مشاكل فقط
          </label>
          <label>
            <input type="checkbox" checked={includeDelivered} onChange={(event) => { setIncludeDelivered(event.target.checked); setPage(1); }} />
            تضمين المُسلّمة في آخر 60 يوم
          </label>
          <label className="oc-field" style={{ display: 'inline-flex', gap: 8 }}>
            <span>الترتيب</span>
            <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })} style={{ width: 'auto' }}>
              {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="oc-toggles-end">
            <div className="oc-segment" role="group" aria-label="طريقة العرض">
              <button type="button" aria-pressed={!isCustomerView} onClick={() => update({ view: 'packages' })}>حسب الطرد</button>
              <button type="button" aria-pressed={isCustomerView} onClick={() => update({ view: 'customers' })}>حسب الزبون</button>
            </div>
          </div>
        </div>
      </section>

      {activeFilterChips.length > 0 &&
        <div className="oc-active-filters">
          <span>الفلاتر المطبقة:</span>
          {activeFilterChips.map(chip => (
            <button key={chip.label} type="button" onClick={() => update(chip.clear)} aria-label={`إزالة ${chip.label}`}>
              {chip.label}
              <X size={12} strokeWidth={2.5} />
            </button>
          ))}
          <button type="button" onClick={() => update({ ...DEFAULT_FILTERS, view: filters.view, sort: filters.sort })}>مسح الكل</button>
        </div>
      }

      {isLoading && !data ? (
        <div className="oc-skeleton" aria-busy="true" aria-label="جارٍ التحميل">
          {Array.from({ length: 6 }).map((_, i) => <i key={i} />)}
        </div>
      ) : totalItems === 0 ? (
        <div className="oc-empty">
          <PackageSearch size={30} strokeWidth={1.5} />
          <strong>{rows.length === 0 ? 'لا توجد طلبيات مفتوحة' : 'لا توجد نتائج مطابقة'}</strong>
          <p>{rows.length === 0 ? 'كل الطلبيات منتهية. فعّل «تضمين المُسلّمة» لمراجعة ما سُلّم مؤخراً.' : 'غيّر الفلاتر أو امسحها لرؤية المزيد.'}</p>
        </div>
      ) : (
        <>
          <div className="oc-results-head">
            <span>
              {isCustomerView
                ? <><strong>{formatNumber(customers.length)}</strong> زبون، <strong>{formatNumber(filtered.length)}</strong> طرد</>
                : <><strong>{formatNumber(filtered.length)}</strong> طرد</>}
              {filteredCost > 0 && <>، شحن مستحق للجاهزة منها <strong>{formatNumber(filteredCost)}$</strong></>}
            </span>
            {isLoading && <span>جارٍ التحديث…</span>}
          </div>

          <div className="oc-table-wrap">
            {isCustomerView ? (
              <table className="oc-table">
                <thead>
                  <tr>
                    <th>الزبون</th>
                    <th>الهاتف</th>
                    <th className="is-num">الطرود</th>
                    <th className="is-num">جاهزة للتسليم</th>
                    <th className="is-num">الشحن المستحق</th>
                    <th className="is-num">أطول انتظار</th>
                    <th className="is-num">بها مشاكل</th>
                    <th><span className="visually-hidden">إجراءات</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageCustomers.map(group => {
                    const wa = whatsappLink(group.phone);
                    return (
                      <tr key={group.key}>
                        <td>
                          <div className="oc-cell">
                            <strong>{group.customerName || 'غير معروف'}</strong>
                            <small>{group.customerId} {group.offices.size > 0 && `· ${Array.from(group.offices).map(officeLabel).join('، ')}`}</small>
                          </div>
                        </td>
                        <td className="oc-mono">{group.phone || '-'}</td>
                        <td className="is-num">{group.packages} <small className="oc-ok-mark">({group.orders.size} طلبية)</small></td>
                        <td className="is-num">{group.ready}</td>
                        <td className="is-num">{group.readyCost > 0 ? `${formatNumber(group.readyCost)}$` : '-'}</td>
                        <td className="is-num">{group.oldestDays} يوم</td>
                        <td className="is-num">{group.issues || '-'}</td>
                        <td>
                          <div className="oc-row-actions">
                            {group.customerMongoId &&
                              <a href={`/user/${group.customerMongoId}`} target="_blank" rel="noreferrer" title="صفحة الزبون"><UserRound size={15} strokeWidth={2} /></a>
                            }
                            {wa && <a href={wa} target="_blank" rel="noreferrer" title="واتساب"><MessageCircle size={15} strokeWidth={2} /></a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="oc-table">
                <thead>
                  <tr>
                    <th>الزبون</th>
                    <th>الطلبية</th>
                    <th>الطرد</th>
                    <th>المرحلة</th>
                    <th className="is-num">الوزن</th>
                    <th className="is-num">قيمة الشحن</th>
                    <th>المكان</th>
                    <th>الفحص</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => (
                    <tr key={row.key}>
                      <td>
                        <div className="oc-cell">
                          <strong>{row.customerName || 'غير معروف'}</strong>
                          <small>
                            {row.customerId}
                            {row.phone && <> · <span className="oc-mono">{row.phone}</span></>}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="oc-cell">
                          <a href={`/invoice/${row.orderMongoId}/edit`} target="_blank" rel="noreferrer" className="oc-mono">
                            {row.orderId} <ExternalLink size={11} strokeWidth={2} />
                          </a>
                          <small>
                            {row.orderType === 'purchase' ? 'شراء وشحن' : 'شحن فقط'} · {officeLabel(row.office)}
                            {row.orderAge !== null && ` · منذ ${row.orderAge} يوم`}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="oc-cell">
                          {row.trackingNumber ? <span className="oc-mono">{row.trackingNumber}</span> : <small>-</small>}
                          <small>
                            {METHOD_LABELS[row.method] || row.method}
                            {row.receiptNo && <> · إيصال <span className="oc-mono">{row.receiptNo}</span></>}
                            {row.boxesCount && ` · ${row.boxesCount} صناديق`}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="oc-cell">
                          <span className={`oc-pill is-${row.stage}`}>{stageLabel(row.stage)}</span>
                          {row.days !== null && <small>{row.stage === 'noPackages' ? 'عمر الطلبية' : row.stage === 'delivered' ? 'منذ التسليم' : 'منذ الوصول'}: {row.days} يوم</small>}
                        </div>
                      </td>
                      <td className="is-num">{row.weight ? `${formatNumber(row.weight)} ${row.unit}` : '-'}</td>
                      <td className="is-num">
                        {row.shippingCost ? `${formatNumber(row.shippingCost)}$` : '-'}
                        {row.exiosPrice > 0 && <div><small className="oc-ok-mark">{formatNumber(row.exiosPrice)}$ للوحدة</small></div>}
                      </td>
                      <td>
                        <div className="oc-cell">
                          {row.warehouse ? <span>مخزن {officeLabel(row.warehouse)}</span> : <small>ليست في مخزن</small>}
                          {row.voyage && (
                            <a href={`/inventory/${row.voyage._id}/edit`} target="_blank" rel="noreferrer">
                              <small>{row.voyage.name}</small>
                            </a>
                          )}
                          {row.locationPlace && <small>{row.locationPlace}</small>}
                        </div>
                      </td>
                      <td>
                        {row.issues.length > 0 ? (
                          <div className="oc-issues">
                            {row.issues.map(code => (
                              <button
                                key={code}
                                type="button"
                                className={`oc-issue is-${ISSUES[code]?.tone || 'info'}`}
                                title={ISSUES[code]?.description}
                                onClick={() => update({ issue: code, stage: 'all' })}
                              >
                                {issueLabel(code)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="oc-ok-mark">سليم</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pageCount > 1 &&
            <div className="oc-pagination">
              <button type="button" className="oc-btn is-small" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>السابق</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" className="oc-btn is-small" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>التالي</button>
            </div>
          }
        </>
      )}

      <p className="oc-ok-mark" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ClipboardList size={14} strokeWidth={2} />
        هذه الصفحة للعرض والمراجعة فقط، ولا تغيّر أي بيانات. افتح الطلبية لتعديلها.
      </p>
    </div>
  );
};

export default OrdersControl;
