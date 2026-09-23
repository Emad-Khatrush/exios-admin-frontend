import { useEffect, useState, useMemo } from 'react';
import './UserOrders.scss';
import api, { base } from '../../api';
import { Invoice, Package } from '../../models';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert,
  AvatarGroup,
  Avatar,
  InputAdornment,
} from '@mui/material';
import { Boxes, CircleCheck, MapPin, Package as PackageIcon, PackageOpen, Plane, TriangleAlert, Wallet } from 'lucide-react';
import SwipeableTextMobileStepper from '../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import { convertGoogleStorageUrl } from '../../utils/methods';

// Paying up to this many USD short of (or over) the total is accepted to absorb rounding.
const PAYMENT_TOLERANCE_USD = 2;

type SelectedPackage = {
  id: string;
  cost: number;
  trackingNumber: string;
  weight: number;
  measureUnit: string;
  exiosPrice: number;
  locationPlace?: string;
  boxesCount?: string | number;
  orderId?: string;
  images?: any;
};

type PaymentInput = { amountUSD: string; amountLYD: string };

const emptyPayment: PaymentInput = { amountUSD: '', amountLYD: '' };

const toNumber = (value: string | number | undefined) => {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

// Same rounding as calculateRate on the server (4 decimals)
const calculateRate = (amountLYD: number, remainingUSD: number) => Math.round((amountLYD / remainingUSD) * 10000) / 10000;

const formatMoney = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getPackageCost = (pkg: Package): number => {
  const weight = pkg?.deliveredPackages?.weight?.total || 0;
  const price = pkg?.deliveredPackages?.exiosPrice || 0;
  return Number((weight * price).toFixed(2));
};

const toSelectedPackage = (pkg: any, orderId: string): SelectedPackage => ({
  id: pkg._id,
  cost: getPackageCost(pkg),
  trackingNumber: pkg?.deliveredPackages?.trackingNumber || '',
  weight: pkg?.deliveredPackages?.weight?.total || 0,
  measureUnit: pkg?.deliveredPackages?.weight?.measureUnit || '',
  exiosPrice: pkg?.deliveredPackages?.exiosPrice || 0,
  locationPlace: pkg?.deliveredPackages?.locationPlace || '',
  boxesCount: pkg?.deliveredPackages?.boxesCount || '',
  images: pkg?.images || [],
  orderId,
});

// Received packages were already delivered (and paid for), so they can never be selected again
const isSelectable = (pkg: any) => !pkg?.status?.received;

const tabs = [
  { value: 'active', label: 'Active', tabType: 'active' },
  { value: 'readyToDeliver', label: 'Ready to deliver', tabType: 'readyForPickup' },
  { value: 'finished', label: 'Finished', tabType: 'finished' },
];

const CustomerOrders = ({ customerId, balances }: any) => {
  const [orders, setOrders] = useState<Invoice[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [filter, setFilter] = useState<string>('active');
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [resMessage, setResMessage] = useState<string>();
  const [payment, setPayment] = useState<PaymentInput>(emptyPayment);
  const [previewImages, setPreviewImages] = useState<any>();

  const [cancelToken, setCancelToken] = useState();

  const walletUsd = toNumber(balances?.walletUsd);
  const walletLyd = toNumber(balances?.walletLyd);

  const fetchOrders = async (tabType: string) => {
    try {
      setIsOrdersLoading(true);
      const res = await api.get(`user/${customerId}/packages`, { cancelToken, tabType });
      setOrders(res.data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders('active');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleFilterChange = (newFilter: string) => {
    const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
    setCancelToken(cancelTokenSource);
    setFilter(newFilter);
    setSelectedPackages([]);

    const tabType = tabs.find(tab => tab.value === newFilter)?.tabType || 'active';
    fetchOrders(tabType);
  };

  const groupedFlights = useMemo(() => {
    const map = new Map();

    orders.forEach((order: any) => {
      (order.paymentList || []).forEach((pkg: any) => {
        const flightId = pkg.flight?._id || 'unassigned';

        if (!map.has(flightId)) {
          map.set(flightId, {
            id: flightId,
            flight: pkg.flight || null,
            packages: [],
          });
        }

        map.get(flightId).packages.push({
          ...pkg,
          orderId: order.orderId,
          orderMongoId: order._id,
        });
      });
    });

    return Array.from(map.values());
  }, [orders]);

  const selectablePackages = useMemo(
    () => groupedFlights.flatMap((group: any) => group.packages.filter(isSelectable)),
    [groupedFlights]
  );

  const isPackageSelected = (id: string) => selectedPackages.some((p) => p.id === id);

  const allSelected = selectablePackages.length > 0 && selectablePackages.every((pkg: any) => isPackageSelected(pkg._id));

  const addPackages = (packages: any[]) => {
    setSelectedPackages(prev => [
      ...prev,
      ...packages
        .filter(pkg => !prev.some(p => p.id === pkg._id))
        .map(pkg => toSelectedPackage(pkg, pkg.orderId)),
    ]);
  };

  const removePackages = (packages: any[]) => {
    const ids = packages.map(pkg => pkg._id);
    setSelectedPackages(prev => prev.filter(p => !ids.includes(p.id)));
  };

  const handlePackageSelect = (pkg: any) => {
    isPackageSelected(pkg._id) ? removePackages([pkg]) : addPackages([pkg]);
  };

  const handleSelectAll = () => {
    allSelected ? removePackages(selectablePackages) : addPackages(selectablePackages);
  };

  const isFlightSelected = (group: any) => {
    const selectable = group.packages.filter(isSelectable);
    return selectable.length > 0 && selectable.every((pkg: any) => isPackageSelected(pkg._id));
  };

  const handleFlightSelect = (group: any) => {
    const selectable = group.packages.filter(isSelectable);
    isFlightSelected(group) ? removePackages(selectable) : addPackages(selectable);
  };

  const totals = useMemo(() => {
    let totalKG = 0;
    let totalCBM = 0;
    let totalFees = 0;

    selectedPackages.forEach(pkg => {
      if (pkg.measureUnit === 'KG') totalKG += pkg.weight;
      if (pkg.measureUnit === 'CBM') totalCBM += pkg.weight;
      totalFees += pkg.cost;
    });

    return { totalKG, totalCBM, totalFees: Number(totalFees.toFixed(2)) };
  }, [selectedPackages]);

  // The rate is calculated, never typed (the server calculates it the same way):
  // USD only -> 0, LYD only -> LYD / total, both -> USD is taken first and LYD pays the rest.
  const paymentSummary = useMemo(() => {
    const amountUSD = toNumber(payment.amountUSD);
    const amountLYD = toNumber(payment.amountLYD);
    const remainingUSD = round2(totals.totalFees - amountUSD);
    const rate = amountLYD > 0 && remainingUSD > 0 ? calculateRate(amountLYD, remainingUSD) : 0;
    const lydInUsd = rate > 0 ? remainingUSD : 0;
    const covered = round2(amountUSD + lydInUsd);
    const difference = round2(covered - totals.totalFees);

    const errors: string[] = [];
    if (amountUSD < 0 || amountLYD < 0) errors.push('Amounts cannot be negative.');
    if (amountUSD > walletUsd + 0.001) errors.push(`USD wallet only has $${formatMoney(walletUsd)}.`);
    if (amountLYD > walletLyd + 0.001) errors.push(`LYD wallet only has ${formatMoney(walletLyd)} LYD.`);
    if (amountLYD > 0 && remainingUSD <= 0) errors.push('The USD amount already covers the total, remove the LYD amount.');
    if (amountUSD === 0 && amountLYD === 0) errors.push('Enter a USD or LYD amount.');
    if (amountLYD === 0 && amountUSD > 0) {
      if (difference < -PAYMENT_TOLERANCE_USD) errors.push(`Payment is $${formatMoney(-difference)} short of the total (max $${PAYMENT_TOLERANCE_USD}).`);
      if (difference > PAYMENT_TOLERANCE_USD) errors.push(`Payment is $${formatMoney(difference)} more than the total (max $${PAYMENT_TOLERANCE_USD}).`);
    }

    return { amountUSD, amountLYD, rate, remainingUSD, lydInUsd, covered, difference, errors };
  }, [payment, totals.totalFees, walletUsd, walletLyd]);

  const updatePayment = (field: keyof PaymentInput) => (event: any) => {
    const value = event.target.value;
    setPayment(prev => ({ ...prev, [field]: value }));
  };

  const payFullInUsd = () => {
    setPayment({ amountUSD: String(round2(Math.min(totals.totalFees, walletUsd))), amountLYD: '' });
  };

  const closeDialog = () => {
    setOpenDialog(false);
    setPayment(emptyPayment);
  };

  const markAsDelivered = async () => {
    if (selectedPackages.length === 0 || paymentSummary.errors.length > 0) return;

    try {
      setIsPending(true);
      await api.post(`user/${customerId}/markAsDelivered`, {
        // Images are only needed for the preview, so don't send them
        selectedPackages: selectedPackages.map(({ images, ...pkg }) => pkg),
        payment: {
          amountUSD: paymentSummary.amountUSD,
          amountLYD: paymentSummary.amountLYD,
          rate: paymentSummary.rate,
        },
        totalCost: totals.totalFees,
      });

      closeDialog();
      handleFilterChange(filter);
      setIsError(false);
      setResMessage('Packages marked as delivered successfully');
    } catch (err: any) {
      console.error(err);
      setIsError(true);
      setResMessage(err?.response?.data?.message || 'Could not mark the packages as delivered. Please try again.');
    } finally {
      setIsPending(false);
      setIsFinished(true);
    }
  };

  const closeSnackbar = () => {
    setIsFinished(false);
    setIsError(false);
    setResMessage('');
  };

  const canSelect = filter !== 'finished';

  return (
    <div className="customer-orders">
      <div className="co-toolbar">
        <div className="co-tabs" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={filter === tab.value}
              className={filter === tab.value ? 'is-active' : ''}
              onClick={() => handleFilterChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canSelect && selectablePackages.length > 0 && !isOrdersLoading && (
          <label className="co-check">
            <input type="checkbox" checked={allSelected} onChange={handleSelectAll} />
            Select all ({selectablePackages.length})
          </label>
        )}
      </div>

      {isOrdersLoading ? (
        <div className="co-skeleton" aria-busy="true" aria-label="Loading orders">
          {[0, 1].map(i => (
            <div key={i} className="co-skeleton-group">
              <div className="co-skeleton-line is-title" />
              <div className="co-skeleton-line" />
              <div className="co-skeleton-line" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {orders.length === 0 && (
            <div className="co-empty">
              <PackageOpen size={36} strokeWidth={1.5} />
              <h3>No packages here</h3>
              <p>Packages will show up once this customer has {filter === 'finished' ? 'delivered' : 'active'} orders.</p>
            </div>
          )}

          {groupedFlights.map((group: any) => (
            <section key={group.id} className="co-flight">
              <header className="co-flight-header">
                <div className="co-flight-title">
                  <span className="co-flight-icon">
                    {group.flight ? <Plane size={18} strokeWidth={2} /> : <PackageIcon size={18} strokeWidth={2} />}
                  </span>
                  <div>
                    {group.flight ? (
                      <>
                        <a href={`/inventory/${group.flight._id || ''}/edit`} target="_blank" rel="noopener noreferrer">
                          Flight {group.flight.voyage}
                        </a>
                        <small>{[group.flight.shippingType, group.flight.inventoryPlace].filter(Boolean).join(' / ')}</small>
                      </>
                    ) : (
                      <span className="co-flight-name">Packages without a flight</span>
                    )}
                  </div>
                </div>

                {canSelect && group.packages.some(isSelectable) && (
                  <label className="co-check">
                    <input type="checkbox" checked={isFlightSelected(group)} onChange={() => handleFlightSelect(group)} />
                    Select flight
                  </label>
                )}
              </header>

              <div className="co-packages">
                {group.packages.map((pkg: any) => {
                  const measureValue = pkg?.deliveredPackages?.weight?.total || 0;
                  const measureUnit = pkg?.deliveredPackages?.weight?.measureUnit || '';
                  const exiosPrice = pkg?.deliveredPackages?.exiosPrice || 0;
                  const selectable = canSelect && isSelectable(pkg);
                  const selected = isPackageSelected(pkg._id);

                  return (
                    <div key={pkg._id} className={`co-package${selected ? ' is-selected' : ''}`}>
                      <div className="co-package-select">
                        {selectable && (
                          <input
                            type="checkbox"
                            aria-label={`Select package ${pkg.deliveredPackages?.trackingNumber || pkg.orderId}`}
                            checked={selected}
                            onChange={() => handlePackageSelect(pkg)}
                          />
                        )}
                      </div>

                      <div className="co-package-main">
                        <div className="co-package-top">
                          <a href={`/invoice/${pkg?.orderMongoId || ''}/edit`} target="_blank" rel="noopener noreferrer">
                            {pkg.orderId}
                          </a>
                          <span className={`co-status ${pkg.status?.received ? 'is-received' : ''}`}>
                            {pkg.status?.received ? 'Received' : 'Active'}
                          </span>
                        </div>
                        <span className="co-tracking">{pkg.deliveredPackages?.trackingNumber || 'No tracking number'}</span>
                        <div className="co-package-meta">
                          {pkg.deliveredPackages?.locationPlace && (
                            <span><MapPin size={14} strokeWidth={2} /> {pkg.deliveredPackages.locationPlace}</span>
                          )}
                          {pkg.deliveredPackages?.boxesCount && (
                            <span><Boxes size={14} strokeWidth={2} /> {pkg.deliveredPackages.boxesCount} boxes</span>
                          )}
                        </div>
                      </div>

                      <dl className="co-package-figures">
                        <div><dt>Measure</dt><dd>{measureValue} {measureUnit}</dd></div>
                        <div><dt>Price</dt><dd>${exiosPrice}</dd></div>
                        <div><dt>Cost</dt><dd className="is-strong">${formatMoney(getPackageCost(pkg))}</dd></div>
                      </dl>

                      {pkg.images?.length > 0 && (
                        <AvatarGroup max={3} className="co-package-images">
                          {pkg.images.map((img: any) => (
                            <Avatar
                              key={img.filename}
                              alt={img.filename}
                              src={convertGoogleStorageUrl(img.path)}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setPreviewImages(pkg.images)}
                            />
                          ))}
                        </AvatarGroup>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {selectedPackages.length > 0 && (
            <div className="co-selection-bar">
              <dl>
                <div><dt>Packages</dt><dd>{selectedPackages.length}</dd></div>
                <div><dt>KG</dt><dd>{totals.totalKG.toFixed(2)}</dd></div>
                <div><dt>CBM</dt><dd>{totals.totalCBM.toFixed(2)}</dd></div>
                <div><dt>Total</dt><dd className="is-strong">${formatMoney(totals.totalFees)}</dd></div>
              </dl>
              <div className="co-selection-actions">
                <button className="co-btn-ghost" onClick={() => setSelectedPackages([])}>Clear</button>
                <button className="co-btn-primary" onClick={() => setOpenDialog(true)}>Deliver selected</button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={openDialog} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ className: 'co-dialog' }}>
        <DialogContent>
          <div className="co-dialog-head">
            <h2>Confirm delivery</h2>
            <p>{selectedPackages.length} package{selectedPackages.length === 1 ? '' : 's'}, paid from the customer's wallet.</p>
          </div>

          <div className="co-wallets">
            <div>
              <span><Wallet size={14} strokeWidth={2} /> USD wallet</span>
              <strong>${formatMoney(walletUsd)}</strong>
            </div>
            <div>
              <span><Wallet size={14} strokeWidth={2} /> LYD wallet</span>
              <strong>{formatMoney(walletLyd)} LYD</strong>
            </div>
            <div className="is-due">
              <span>Total due</span>
              <strong>${formatMoney(totals.totalFees)}</strong>
            </div>
          </div>

          <div className="co-payment-grid">
            <TextField
              fullWidth
              label="From USD wallet"
              type="number"
              inputProps={{ inputMode: 'decimal', step: 0.01, min: 0 }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              value={payment.amountUSD}
              onChange={updatePayment('amountUSD')}
              onWheel={(event: any) => event.target.blur()}
              helperText={<button type="button" className="co-link-btn" onClick={payFullInUsd}>Pay all in USD</button>}
            />
            <TextField
              fullWidth
              label="From LYD wallet"
              type="number"
              inputProps={{ inputMode: 'decimal', step: 0.01, min: 0 }}
              InputProps={{ endAdornment: <InputAdornment position="end">LYD</InputAdornment> }}
              value={payment.amountLYD}
              onChange={updatePayment('amountLYD')}
              onWheel={(event: any) => event.target.blur()}
              helperText={paymentSummary.amountUSD > 0 ? `Pays the $${formatMoney(Math.max(0, paymentSummary.remainingUSD))} left after USD` : 'Pays the whole total'}
            />
            <TextField
              fullWidth
              label="Exchange rate"
              value={paymentSummary.rate > 0 ? paymentSummary.rate : 0}
              disabled
              InputProps={{ endAdornment: <InputAdornment position="end">LYD / $</InputAdornment> }}
              helperText={paymentSummary.rate > 0
                ? `${formatMoney(paymentSummary.amountLYD)} LYD / $${formatMoney(paymentSummary.remainingUSD)}`
                : 'Calculated from the LYD amount'}
            />
          </div>

          <dl className="co-breakdown">
            <div><dt>USD</dt><dd>${formatMoney(paymentSummary.amountUSD)}</dd></div>
            <div>
              <dt>LYD {paymentSummary.rate > 0 && <small>({formatMoney(paymentSummary.amountLYD)} LYD at {paymentSummary.rate})</small>}</dt>
              <dd>${formatMoney(paymentSummary.lydInUsd)}</dd>
            </div>
            <div className="is-total">
              <dt>Covered</dt>
              <dd>${formatMoney(paymentSummary.covered)} of ${formatMoney(totals.totalFees)}</dd>
            </div>
          </dl>

          {paymentSummary.errors.length > 0 ? (
            <ul className="co-errors" role="alert">
              {paymentSummary.errors.map(error => (
                <li key={error}><TriangleAlert size={16} strokeWidth={2} /> {error}</li>
              ))}
            </ul>
          ) : (
            <p className="co-ok"><CircleCheck size={16} strokeWidth={2} /> Payment covers the total.</p>
          )}

          <details className="co-selected-list">
            <summary>Selected packages ({selectedPackages.length})</summary>
            {selectedPackages.map(pkg => (
              <div key={pkg.id} className="co-selected-item">
                <div>
                  <span className="co-tracking">{pkg.trackingNumber || 'No tracking number'}</span>
                  <small>
                    {pkg.weight} {pkg.measureUnit} x ${pkg.exiosPrice || 0}
                    {pkg.boxesCount ? `, ${pkg.boxesCount} boxes` : ''}
                    {pkg.locationPlace ? `, ${pkg.locationPlace}` : ''}
                  </small>
                </div>
                <strong>${formatMoney(pkg.cost)}</strong>
              </div>
            ))}
          </details>
        </DialogContent>
        <DialogActions className="co-dialog-actions">
          <button className="co-btn-ghost" onClick={closeDialog}>Cancel</button>
          <button className="co-btn-primary" onClick={markAsDelivered} disabled={paymentSummary.errors.length > 0 || isPending}>
            Confirm delivery
          </button>
        </DialogActions>
      </Dialog>

      <Backdrop sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1000 }} open={isPending}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Snackbar open={isFinished} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert severity={isError ? 'error' : 'success'} sx={{ width: '100%' }} onClose={closeSnackbar}>
          {resMessage}
        </Alert>
      </Snackbar>

      <Dialog open={!!previewImages} onClose={() => setPreviewImages(undefined)}>
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CustomerOrders;
