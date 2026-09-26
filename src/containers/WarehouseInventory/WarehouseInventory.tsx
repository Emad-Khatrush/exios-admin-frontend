import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Breadcrumbs, Button, Dialog, DialogActions, DialogContent, Link, Typography } from '@mui/material';
import moment from 'moment-timezone';
import {
  AlertTriangle, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Image as ImageIcon,
  MapPin, MessageCircle, Package, PackagePlus, Phone, Search, ShieldAlert, SquareArrowOutUpRight,
  Trash2, Warehouse
} from 'lucide-react';
import api from '../../api';
import TextInput from '../../components/TextInput/TextInput';
import SwipeableTextMobileStepper from '../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import ActivityDialog from '../../components/TransferOrdersList/ActivityDialog';
import { calculateMinTotalPrice } from '../../utils/methods';
import DeletePackageDialog from './DeletePackageDialog';
import AddPackagesDialog from './AddPackagesDialog';
import WeeklyCheckDialog from './WeeklyCheckDialog';
import DeletionLogDialog from './DeletionLogDialog';

import './WarehouseInventory.scss';

type Office = 'tripoli' | 'benghazi';

const OFFICES: { value: Office; label: string; icon: typeof Building2 }[] = [
  { value: 'tripoli', label: 'طرابلس', icon: Building2 },
  { value: 'benghazi', label: 'بنغازي', icon: Building2 },
];

const PAGE_SIZE = 20;

const fullName = (order: any) => order?.customerInfo?.fullName || 'غير معروف';
const weightOf = (order: any) => order?.paymentList?.deliveredPackages?.weight || {};
const packageKey = (order: any) => order?.paymentList?._id || order?._id;

// A package's shipping fee is considered overdue once it's sat past the
// office's pickup window (air moves faster, so its window is shorter) and
// the customer still hasn't paid it off - same rule Shippings uses to flag rows.
const getDeadlineDays = (order: any) => (order?.shipment?.method === 'air' ? 25 : 65);

const isFeeUnpaid = (order: any) => {
  const pkg = order?.paymentList?.deliveredPackages;
  if (!pkg) return false;
  const owed = (pkg.exiosPrice || 0) * (pkg.weight?.total || 0) * 5;
  const paid = (pkg.receivedShipmentLYD || 0) + (pkg.receivedShipmentUSD || 0) * 5;
  return owed > paid;
};

const daysSinceArrival = (order: any): number | null => {
  const arrivedAt = order?.paymentList?.deliveredPackages?.arrivedAt;
  if (!order?.paymentList?.status?.arrived || !arrivedAt) return null;
  return moment().diff(moment(arrivedAt), 'days');
};

type Urgency = 'onTime' | 'dueSoon' | 'overdue' | 'unknown';

const getUrgency = (order: any): Urgency => {
  const days = daysSinceArrival(order);
  if (days === null) return 'unknown';
  if (!isFeeUnpaid(order)) return 'onTime';
  const daysLeft = getDeadlineDays(order) - days;
  if (daysLeft <= 0) return 'overdue';
  if (daysLeft <= 5) return 'dueSoon';
  return 'onTime';
};

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">الرئيسية</Link>,
  <Typography key="2" color="#28323C">المخزن</Typography>,
];

const WarehouseInventory = () => {
  const isAdmin = useSelector((state: any) => !!state.session?.account?.roles?.isAdmin);

  const [office, setOffice] = useState<Office>('tripoli');
  const [inventory, setInventory] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Office, number>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [previewImages, setPreviewImages] = useState<any>();
  const [showDialog, setShowDialog] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showWeeklyCheck, setShowWeeklyCheck] = useState(false);
  const [showDeletionLog, setShowDeletionLog] = useState(false);

  const loadOffice = useCallback(async (target: Office) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get(`warehouse/${target}/goods`);
      const doc = response.data[0] || null;
      setInventory(doc);
      setOrders(doc?.orders || []);
      setCounts((prev) => ({ ...prev, [target]: doc?.orders?.length || 0 }));
    } catch (err: any) {
      setInventory(null);
      setOrders([]);
      setCounts((prev) => ({ ...prev, [target]: 0 }));
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.message || 'تعذر تحميل بيانات هذا المخزن.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load the active office, and quietly fetch the other one's count in the
  // background so both tab badges are accurate right away.
  useEffect(() => {
    loadOffice('tripoli');
    api.get('warehouse/benghazi/goods')
      .then((res) => setCounts((prev) => ({ ...prev, benghazi: res.data[0]?.orders?.length || 0 })))
      .catch(() => setCounts((prev) => ({ ...prev, benghazi: 0 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchOffice = (target: Office) => {
    setOffice(target);
    setSelected(new Set());
    setPage(1);
    setSearchValue('');
    loadOffice(target);
  };

  const filteredOrders = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => [
      fullName(order),
      order?.orderId,
      order?.user?.customerId,
      order?.user?.phone,
      order?.paymentList?.deliveredPackages?.trackingNumber,
      order?.paymentList?.deliveredPackages?.receiptNo,
    ].some((value) => value && String(value).toLowerCase().includes(q)));
  }, [orders, searchValue]);

  const stats = useMemo(() => {
    let totalKG = 0, totalCBM = 0, overdue = 0, dueSoon = 0;
    orders.forEach((order) => {
      const w = weightOf(order);
      if (w.measureUnit === 'KG') totalKG += w.total || 0;
      if (w.measureUnit === 'CBM') totalCBM += w.total || 0;
      const urgency = getUrgency(order);
      if (urgency === 'overdue') overdue++;
      if (urgency === 'dueSoon') dueSoon++;
    });
    return { totalKG, totalCBM, overdue, dueSoon, total: orders.length };
  }, [orders]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const visibleIds = pagedOrders.map(packageKey).filter(Boolean);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedOrders = orders.filter((order) => selected.has(packageKey(order)));

  const handlePackageDeleted = (paymentListId: string) => {
    setOrders((prev) => prev.filter((order) => packageKey(order) !== paymentListId));
    setCounts((prev) => ({ ...prev, [office]: Math.max(0, (prev[office] || 1) - 1) }));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(paymentListId);
      return next;
    });
    setDeletingOrder(null);
  };

  const officeLabel = OFFICES.find((o) => o.value === office)?.label || office;

  return (
    <div className="m-4 warehouse" dir="rtl" lang="ar">
      <Breadcrumbs separator="‹" aria-label="breadcrumb" className="mb-3">
        {breadcrumbs}
      </Breadcrumbs>

      <nav className="warehouse-tabs" role="tablist" aria-label="المكتب">
        {OFFICES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={office === item.value}
            className={office === item.value ? 'is-active' : ''}
            onClick={() => switchOffice(item.value)}
          >
            <item.icon size={15} strokeWidth={2} />
            {item.label}
            <span className="warehouse-tabs__count">{counts[item.value] ?? '-'}</span>
          </button>
        ))}
      </nav>

      <div className="warehouse__card">
        <header className="warehouse__header">
          <div>
            <h5 className="warehouse__title">
              <Warehouse size={18} strokeWidth={2} />
              مخزن {officeLabel}
            </h5>
            <p className="warehouse__subtitle">
              الطرود الموجودة في هذا المكتب بانتظار استلام الزبون لها.
            </p>
          </div>

          <div className="warehouse__actions">
            <button type="button" className="wh-btn" onClick={() => setShowWeeklyCheck(true)}>
              <ClipboardCheck size={14} strokeWidth={2} />
              الفحص الأسبوعي
            </button>
            {isAdmin &&
              <button type="button" className="wh-btn" onClick={() => setShowDeletionLog(true)}>
                <ShieldAlert size={14} strokeWidth={2} />
                سجل الحذف
              </button>
            }
            <button type="button" className="wh-btn wh-btn--primary" onClick={() => setShowAddDialog(true)} disabled={!inventory}>
              <PackagePlus size={14} strokeWidth={2} />
              إضافة طرود
            </button>
          </div>
        </header>

        <div className="warehouse__stats">
          <div className="warehouse__stat">
            <span className="warehouse__stat-value">{stats.total}</span>
            <span className="warehouse__stat-label">الطرود</span>
          </div>
          <div className="warehouse__stat">
            <span className="warehouse__stat-value">{stats.totalKG.toFixed(1)}</span>
            <span className="warehouse__stat-label">إجمالي كغم</span>
          </div>
          <div className="warehouse__stat">
            <span className="warehouse__stat-value">{stats.totalCBM.toFixed(1)}</span>
            <span className="warehouse__stat-label">إجمالي م.مكعب</span>
          </div>
          <div className="warehouse__stat is-warning">
            <span className="warehouse__stat-value">{stats.dueSoon}</span>
            <span className="warehouse__stat-label">يستحق قريبًا</span>
          </div>
          <div className="warehouse__stat is-danger">
            <span className="warehouse__stat-value">{stats.overdue}</span>
            <span className="warehouse__stat-label">متأخر</span>
          </div>
        </div>

        <div className="warehouse__toolbar" dir="ltr">
          <TextInput
            key={office}
            placeholder="ابحث بالاسم، رقم الطلب، رقم التتبع، الإيصال أو الهاتف"
            icon={<Search size={15} strokeWidth={2} />}
            onChange={(event: any) => { setSearchValue(event.target.value); setPage(1); }}
          />
        </div>

        {selected.size > 0 &&
          <div className="warehouse__selection-bar">
            <span>تم تحديد {selected.size}</span>
            <div>
              <button type="button" onClick={() => setSelected(new Set())}>إلغاء التحديد</button>
              <button type="button" className="is-primary" onClick={() => setShowDialog(true)}>
                <MessageCircle size={14} strokeWidth={2} />
                إرسال رسالة / إضافة نشاط
              </button>
            </div>
          </div>
        }

        {error && <p className="warehouse__error" role="alert">{error}</p>}

        {isLoading ?
          <div className="warehouse__list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="warehouse__row warehouse__row--skeleton">
                <span className="warehouse__skeleton-bar" style={{ width: '40%', height: 14 }} />
                <span className="warehouse__skeleton-bar" style={{ width: '60%', height: 12 }} />
              </div>
            ))}
          </div>
          :
          <>
            {pagedOrders.length > 0 &&
              <label className="warehouse__select-all">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                تحديد الكل في هذه الصفحة
              </label>
            }

            <div className="warehouse__list">
              {pagedOrders.map((order) => {
                const key = packageKey(order);
                const pkg = order?.paymentList?.deliveredPackages || {};
                const w = weightOf(order);
                const days = daysSinceArrival(order);
                const urgency = getUrgency(order);
                const images = order?.images || [];
                const cost = pkg.exiosPrice && w.total
                  ? calculateMinTotalPrice(pkg.exiosPrice, w.total, inventory?.shippedCountry, w.measureUnit)
                  : null;

                return (
                  <article key={key} className={`warehouse__row is-${urgency}`}>
                    <input
                      type="checkbox"
                      className="warehouse__checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleSelected(key)}
                      aria-label={`تحديد ${fullName(order)}`}
                    />

                    <div className="warehouse__who">
                      <div>
                        <a href={`/invoice/${order._id}/edit`} target="_blank" rel="noreferrer" className="warehouse__name">
                          {fullName(order)}
                          {order?.user?.customerId && <span className="warehouse__code">{order.user.customerId}</span>}
                          <SquareArrowOutUpRight size={11} strokeWidth={2} />
                        </a>
                        <div className="warehouse__meta">
                          {order?.orderId && <span>طلب {order.orderId}</span>}
                          {pkg.trackingNumber && <span>تتبع {pkg.trackingNumber}</span>}
                          {order?.user?.phone && <span><Phone size={11} strokeWidth={2} /> {order.user.phone}</span>}
                          {pkg.locationPlace && <span><MapPin size={11} strokeWidth={2} /> {pkg.locationPlace}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="warehouse__figures">
                      {w.total ?
                        <span className="warehouse__weight">{w.total} {w.measureUnit}</span>
                        : <span className="warehouse__weight is-empty">-</span>
                      }
                      {cost && <span className="warehouse__cost">${cost}</span>}
                    </div>

                    <div className="warehouse__tracking">
                      {days !== null ?
                        <span className={`warehouse__pill is-${urgency}`}>
                          {urgency === 'overdue' && <AlertTriangle size={12} strokeWidth={2} />}
                          {urgency === 'dueSoon' && <CalendarClock size={12} strokeWidth={2} />}
                          {urgency === 'onTime' && <CheckCircle2 size={12} strokeWidth={2} />}
                          {days} يوم في المخزن
                        </span>
                        :
                        <span className="warehouse__pill is-unknown">لم يُسجل وصوله</span>
                      }
                      {isFeeUnpaid(order) && days !== null &&
                        <span className="warehouse__unpaid">رسوم الشحن غير مدفوعة</span>
                      }
                    </div>

                    <div className="warehouse__row-actions">
                      <button
                        type="button"
                        className="warehouse__images"
                        disabled={images.length === 0}
                        onClick={() => setPreviewImages(images)}
                        title={images.length ? `${images.length} صورة` : 'لا توجد صور'}
                      >
                        <ImageIcon size={14} strokeWidth={2} />
                        {images.length}
                      </button>
                      <button
                        type="button"
                        className="warehouse__delete"
                        onClick={() => setDeletingOrder(order)}
                        title="حذف هذا الطرد"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </article>
                );
              })}

              {!isLoading && filteredOrders.length === 0 &&
                <div className="warehouse__empty">
                  <Package size={28} strokeWidth={1.5} />
                  <p className="m-0 fw-semibold">{searchValue ? 'لا توجد طرود مطابقة لبحثك' : 'هذا المخزن فارغ'}</p>
                  <p className="m-0">{searchValue ? 'جرّب اسمًا أو رقم طلب أو تتبع أو إيصال مختلف.' : 'الطرود التي تُنقل إلى هنا ستظهر في هذه القائمة.'}</p>
                </div>
              }
            </div>

            {pageCount > 1 &&
              <div className="warehouse__pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</button>
                <span>{page} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>التالي</button>
              </div>
            }
          </>
        }
      </div>

      <Dialog open={!!previewImages} onClose={() => setPreviewImages(undefined)}>
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} className="p-5" fullWidth>
        <ActivityDialog
          checked={selectedOrders}
          setShowDialog={setShowDialog}
          inventory={inventory}
        />
      </Dialog>

      {deletingOrder &&
        <DeletePackageDialog
          inventoryId={inventory?._id}
          order={deletingOrder}
          onClose={() => setDeletingOrder(null)}
          onDeleted={handlePackageDeleted}
        />
      }

      {showAddDialog && inventory &&
        <AddPackagesDialog
          inventoryId={inventory._id}
          officeLabel={officeLabel}
          onClose={() => setShowAddDialog(false)}
          onAdded={() => { setShowAddDialog(false); loadOffice(office); }}
        />
      }

      {showWeeklyCheck &&
        <WeeklyCheckDialog
          office={office}
          officeLabel={officeLabel}
          inventoryId={inventory?._id}
          orders={orders}
          onClose={() => setShowWeeklyCheck(false)}
          onSubmitted={() => {}}
        />
      }

      {showDeletionLog &&
        <DeletionLogDialog
          office={office}
          officeLabel={officeLabel}
          onClose={() => setShowDeletionLog(false)}
        />
      }
    </div>
  );
};

export default WarehouseInventory;
