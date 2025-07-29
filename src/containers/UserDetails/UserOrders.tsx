import { useEffect, useState, useMemo } from 'react';
import './UserOrders.scss';
import api, { base } from '../../api';
import { Invoice, Package } from '../../models';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Typography,
  Box,
  TextField,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';

const CustomerOrders = ({ customerId, balances }: any) => {
  const [orders, setOrders] = useState<Invoice[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<{
    id: string;
    cost: number;
    trackingNumber: string;
    weight: number;
    measureUnit: string;
    exiosPrice: number;
    orderId?: string;
  }[]>([]);
  const [filter, setFilter] = useState<string>('active');
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [resMessage, setResMessage] = useState<string>();
  const [payment, setPayment] = useState<{ amountUSD: number; amountLYD: number; rate: number }>({
    amountUSD: 0,
    amountLYD: 0,
    rate: 0,
  });

  const [cancelToken, setCancelToken] = useState();

  const fetchOrders = async (tabType: string) => {
    try {
      setIsOrdersLoading(true);
      const res = await api.get(`user/${customerId}/packages`, { cancelToken, tabType });
      setOrders(res.data.results || []);
      setIsOrdersLoading(false);
    } catch (err) {
      console.error(err);
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
    setSelectAll(false);
    setSelectedPackages([]);

    let tabType = 'active';
    if (newFilter === 'readyToDeliver') tabType = 'readyForPickup';
    if (newFilter === 'finished') tabType = 'finished';

    fetchOrders(tabType);
  };

  const getPackageCost = (pkg: Package): number => {
    const weight = pkg?.deliveredPackages?.weight?.total || 0;
    const price = pkg?.deliveredPackages?.exiosPrice || 0;
    return weight * price;
  };

  const handlePackageSelect = (pkg: Package, orderId: string) => {
    const alreadySelected = selectedPackages.find(p => p.id === pkg._id);

    if (alreadySelected) {
      setSelectedPackages(prev => prev.filter(p => p.id !== pkg._id));
    } else {
      const cost = getPackageCost(pkg);
      const trackingNumber = pkg.deliveredPackages?.trackingNumber || '';
      const weight = pkg?.deliveredPackages?.weight?.total || 0;
      const measureUnit = pkg?.deliveredPackages?.weight?.measureUnit || '';
      const exiosPrice = pkg?.deliveredPackages?.exiosPrice || 0;

      setSelectedPackages(prev => [
        ...prev,
        { id: pkg._id, cost, trackingNumber, weight, measureUnit, exiosPrice, orderId },
      ]);
    }
  };

  const handleSelectAll = () => {
    const allPackages = filteredOrders.flatMap(order => {
      return order.paymentList.map(pkg => ({
        ...pkg,
        orderId: order.orderId,
      }))
      .filter(pkg => !pkg.status.received); // Only select active packages
    });

    if (selectAll) {
      const allIds = allPackages.map(pkg => pkg._id);
      setSelectedPackages(prev => prev.filter(p => !allIds.includes(p.id)));
    } else {
      const newSelections = allPackages.map(pkg => ({
        id: pkg._id,
        cost: getPackageCost(pkg),
        trackingNumber: pkg?.deliveredPackages?.trackingNumber || '',
        weight: pkg?.deliveredPackages?.weight?.total || 0,
        measureUnit: pkg?.deliveredPackages?.weight?.measureUnit || '',
        exiosPrice: pkg?.deliveredPackages?.exiosPrice || 0,
        orderId: pkg.orderId,
      }));

      const merged = [...selectedPackages];
      newSelections.forEach(newPkg => {
        if (!merged.some(p => p.id === newPkg.id)) {
          merged.push(newPkg);
        }
      });

      setSelectedPackages(merged);
    }

    setSelectAll(!selectAll);
  };

  const markAsDelivered = async () => {
    try {
      if (selectedPackages.length === 0) return;

      if (payment.amountLYD > 0 && payment.rate <= 0) {
        alert('Please enter valid exchange rate for LYD');
        return;
      }

      if (payment.amountUSD > Number(balances.walletUsd)) {
        alert('You do not have enough balance in your USD wallet');
        return;
      }

      if (payment.amountLYD > Number(balances.walletLyd)) {
        alert('You do not have enough balance in your LYD wallet');
        return;
      }
      
      const convertedAmount = Number((payment.amountLYD / payment.rate).toFixed(2));
      console.log((payment.amountUSD + convertedAmount) - 3);
      if ((payment.amountUSD + convertedAmount) < Number(totals.totalFees) - 2) {
        alert('The total cost of the selected packages is greater than the total amount you entered');
        return;
      }
      
      setIsPending(true);
      await api.post(`user/${customerId}/markAsDelivered`, {
        selectedPackages,
        payment,
        totalCost: totals.totalFees,
      });

      setPayment({ amountUSD: 0, amountLYD: 0, rate: 0 });
      handleFilterChange(filter);
      setOpenDialog(false);
      setIsPending(false);
      setIsFinished(true);
      setResMessage('Packages marked as delivered successfully');
    } catch (err: any) {
      console.error(err);
      setIsError(true);
      setIsFinished(true);
      setResMessage(err.response.data.message);
      setIsPending(false);
    }
  };

  const filteredOrders = orders;

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

  return (
    <div className="customer-orders">
      <div className="filters">
        <button className={filter === 'active' ? 'active' : ''} onClick={() => handleFilterChange('active')}>
          Active Orders
        </button>
        <button className={filter === 'readyToDeliver' ? 'active' : ''} onClick={() => handleFilterChange('readyToDeliver')}>
          Ready to Deliver
        </button>
        <button className={filter === 'finished' ? 'active' : ''} onClick={() => handleFilterChange('finished')}>
          Finished Orders
        </button>
      </div>

      { isOrdersLoading ? 
        <CircularProgress />
        :
        <div>
          {selectedPackages.length > 0 && (
            <div className="totals-summary card">
              <h4>📦 Selected Packages Summary</h4>
              <div className="summary-grid">
                <div className="summary-item"><span className="label">Packages</span><span className="value">{selectedPackages.length}</span></div>
                <div className="summary-item"><span className="label">Total KG</span><span className="value">{totals.totalKG.toFixed(2)} kg</span></div>
                <div className="summary-item"><span className="label">Total CBM</span><span className="value">{totals.totalCBM.toFixed(2)} cbm</span></div>
                <div className="summary-item"><span className="label">Total Cost</span><span className="value">${totals.totalFees.toFixed(2)}</span></div>
                <button className="mark-delivered" onClick={() => { setOpenDialog(true); }}>Mark Selected as Delivered</button>
              </div>
            </div>
          )}

          {filteredOrders.length > 0 && filter !== 'finished' && (
            <div className="select-all-container">
              <label className='mr-2'>
                <input type="checkbox" checked={selectAll} onChange={handleSelectAll} /> Select All Packages
              </label>
            </div>
          )}

          {filteredOrders.length === 0 && <p>No orders found for this filter.</p>}

          {filteredOrders.map(order => (
            <div key={order._id} className="order-card">
              <div className="order-header">
                <h3>Order: <a href={`/invoice/${order._id}/edit`} target="_blank" rel="noopener noreferrer">{order.orderId}</a></h3>
                <p>Placed At: {order.placedAt}</p>
              </div>
              <div className="packages">
                <h4>Packages</h4>
                {order.paymentList.map((pkg: Package) => {
                  const measureValue = pkg?.deliveredPackages.weight?.total || 0;
                  const measureUnit = pkg.deliveredPackages?.weight?.measureUnit || '';
                  const exiosPrice = pkg.deliveredPackages?.exiosPrice || 0;
                  const fees = measureValue * exiosPrice;

                  return (
                    <div key={pkg._id} className="package-item">
                      {(filter !== 'finished' && !pkg.status.received) &&
                        <input
                          type="checkbox"
                          checked={selectedPackages.some(p => p.id === pkg._id)}
                          onChange={() => handlePackageSelect(pkg, order.orderId)}
                        />
                      }
                      <div className="package-details">
                        <p>Tracking: {pkg.deliveredPackages?.trackingNumber || 'N/A'}</p>
                        <p>Status: {pkg.status.received ? 'Received✅' : 'Active📦'}</p>
                        <p>Measure: {measureValue} {measureUnit}</p>
                        <p>Exios Price: ${exiosPrice}</p>
                        <p>Cost: ${fees.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <Dialog 
            open={openDialog} 
            onClose={() => {
              setOpenDialog(false);
              setSelectedPackages([]);
              setPayment({ amountUSD: 0, amountLYD: 0, rate: 0 });
            }} 
            maxWidth="sm" 
            fullWidth
          >
            <DialogTitle>
              Confirm Delivery <span style={{ color: '#236106ac' }}>Wallet({`${balances.walletUsd} $, ${balances.walletLyd} LYD`})</span>
            </DialogTitle>
            <DialogContent dividers>
              <div className="row">
                <div className="col-md-4 mb-2">
                  <TextField
                    fullWidth
                    label="Amount (USD)"
                    type="number"
                    inputProps={{ inputMode: 'numeric', step: 0.01 }}
                    value={payment.amountUSD}
                    onChange={e => setPayment(prev => ({ ...prev, amountUSD: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <TextField
                    fullWidth
                    label="Amount (LYD)"
                    type="number"
                    inputProps={{ inputMode: 'numeric', step: 0.01 }}
                    value={payment.amountLYD}
                    onChange={e => setPayment(prev => ({ ...prev, amountLYD: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <TextField
                    fullWidth
                    label="Exchange Rate"
                    type="number"
                    inputProps={{ inputMode: 'numeric', step: 0.01 }}
                    value={payment.rate}
                    onChange={e => setPayment(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <Typography variant="h6" gutterBottom>📦 Selected Packages Summary</Typography>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Box>
                  <Typography variant="body2" color="textSecondary">Packages</Typography>
                  <Typography variant="subtitle1">{selectedPackages.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">Total KG</Typography>
                  <Typography variant="subtitle1">{totals.totalKG.toFixed(2)} kg</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">Total CBM</Typography>
                  <Typography variant="subtitle1">{totals.totalCBM.toFixed(2)} cbm</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">Total Fees</Typography>
                  <Typography variant="subtitle1">${totals.totalFees.toFixed(2)}</Typography>
                </Box>
              </Box>

              <Divider />

              <Typography variant="h6" gutterBottom mt={2}>Selected Packages</Typography>
              {selectedPackages.map(pkg => (
                <Box key={pkg.id} my={1} p={1} border="1px solid #e0e0e0" borderRadius="8px">
                  <Typography variant="body2">Tracking: {pkg.trackingNumber || 'N/A'}</Typography>
                  <Typography variant="body2">Measure: {pkg.weight} {pkg.measureUnit}</Typography>
                  <Typography variant="body2">Exios Price: ${pkg?.exiosPrice || 0}</Typography>
                  <Typography variant="body2">Cost: ${pkg.cost.toFixed(2)}</Typography>
                </Box>
              ))}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setOpenDialog(false);
                setSelectedPackages([]);
                setPayment({ amountUSD: 0, amountLYD: 0, rate: 0 });
              }} color="secondary">Cancel</Button>
              <Button onClick={markAsDelivered} variant="contained" color="primary">
                Confirm Delivery
              </Button>
            </DialogActions>
          </Dialog>

          <Backdrop
            sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1000 }}
            open={isPending}
          >
            <CircularProgress color="inherit" />
          </Backdrop>

          <Snackbar 
            open={isFinished} 
            autoHideDuration={6000}
            onClose={() => { setIsFinished(false); setIsError(false); setResMessage(''); }}
          >
            <Alert 
              severity={isError ? 'error' : 'success'}
              sx={{ width: '100%' }}
              onClose={() => { setIsFinished(false); setIsError(false); setResMessage(''); }}
            >
              {resMessage}
            </Alert>
          </Snackbar>
        </div>
      }
    </div>
  );
};

export default CustomerOrders;
