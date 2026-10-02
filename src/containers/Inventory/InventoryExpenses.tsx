import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Autocomplete,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Snackbar,
  TextField
} from "@mui/material";
import api from "../../api";
import moment from "moment";
import { calculateMinTotalPrice, toExcelSheetName, toFileName } from "../../utils/methods";
import * as XLSX from 'xlsx';
import { Download, Plus, Receipt, Trash2 } from "lucide-react";
import { FieldLabel } from "./InventoryFields";
import { errorText, newKey, sys, todayLibya } from "../Accounting/accountingApi";

import './InventoryForm.scss';

// A trip's costs (spec 4.3, 19.1). Each cost entered here is a supplier bill on the trip, posted to
// accounting at once: paid on the spot from a cash box or bank (in that account's currency), or
// owed to the supplier. Expenses typed on the trip before accounting are listed read-only; the
// historical migration moved them into the books.

interface LegacyExpense {
  _id: string;
  description: string;
  amount: number;
  currency: string;
  rate?: number;
  date: string;
}

// A trip's costs by kind (spec v8): customs is a cost of the trip itself, shared by weight
const COST_CATEGORIES: [string, string][] = [['shipping', 'Shipping'], ['customs', 'Customs'], ['clearance', 'Clearance'], ['transport', 'Transport'], ['other', 'Other']];
const categoryLabel = (value?: string | null) => COST_CATEGORIES.find(([key]) => key === value)?.[1] || '';

interface Bill {
  _id: string;
  costCategory?: string | null;
  number: string;
  day: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  usd: number;
  status: 'posted' | 'canceled';
  paid: boolean;
  paidFrom: string | null;
  createdBy: string;
  createdAt: string;
}

interface Row {
  key: string;
  date: string;
  description: string;
  supplier: string;
  amount: number;
  currency: string;
  usd?: number;
  paidFrom?: string;
  legacy: boolean;
  canceled?: boolean;
  bill?: Bill;
}

interface Props {
  inventoryId: string;
  inventory: any;
}

const emptyForm = () => ({
  vendor: null as any,
  vendorText: '',
  description: '',
  costCategory: 'shipping',
  amount: '',
  payFrom: '',
  currency: 'USD',
  rate: '',
  day: todayLibya(),
});

// How many package payment lookups run at once while building the report
const REPORT_CONCURRENCY = 6;

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

const legacyUsd = (exp: LegacyExpense) => {
  if (exp.currency === "USD") return exp.amount;
  return exp.rate && exp.rate > 0 ? exp.amount / exp.rate : undefined;
};

const InventoryExpenses: React.FC<Props> = ({ inventoryId, inventory }) => {
  const [legacy, setLegacy] = useState<LegacyExpense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string>();
  const [showCanceled, setShowCanceled] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [reportProgress, setReportProgress] = useState<{ done: number, total: number } | null>(null);
  const [toast, setToast] = useState<{ message: string, isError?: boolean } | null>(null);
  const key = useRef(newKey());
  const isDomestic = inventory?.shippingType === 'domestic';

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await sys.get(`acc/trips/${inventoryId}/costs`);
      setLegacy(res.data.legacy || []);
      setBills(res.data.bills || []);
    } catch (error) {
      setToast({ message: errorText(error, 'Could not load the trip costs. Refresh the page.'), isError: true });
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = () => sys.get('acc/options').then((res: any) => {
    setVendors(res.data.vendors || []);
    setAccounts(res.data.accounts || []);
    setCurrencies(res.data.currencies || []);
  }).catch(() => {});

  useEffect(() => {
    if (!inventoryId) return;
    fetchCosts();
    fetchOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  // Payments of one package that belong to it (a payment can cover several packages)
  const getPackageReceived = async (orderPackage: any) => {
    const paymentHistoryResponse = (
      await api.get(`order/${orderPackage._id}/payments`)
    )?.data?.results || [];

    const onlyReceivedGoodsPayments = paymentHistoryResponse.filter(
      (payment: any) => payment.category === "receivedGoods"
    );

    const paymentsOfPackage = onlyReceivedGoodsPayments.filter((payment: any) =>
      payment.list.some(
        (dp: any) =>
          dp.deliveredPackages?.trackingNumber ===
          orderPackage.paymentList.deliveredPackages.trackingNumber
      )
    );

    let orderUSD = 0;
    let orderLYD = 0;
    let rateSum = 0;
    let rateCount = 0;

    paymentsOfPackage.forEach((p: any) => {
      // Calculate AVG rate
      if (p.currency === 'LYD' && p?.rate !== undefined) {
        rateSum += (p?.rate || 0);
        rateCount++;
      }

      if (p.list?.length > 1) {
        let cost;
        let paidAmount = p.receivedAmount;
        p.list.forEach((pkg: any) => {
          if (p.currency === "USD") {
            if (pkg?.deliveredPackages?.trackingNumber !== orderPackage?.paymentList?.deliveredPackages?.trackingNumber) {
              cost = pkg.deliveredPackages.exiosPrice * pkg.deliveredPackages.weight.total;
              paidAmount -= cost;
            }
          } else {
            if (pkg?.deliveredPackages?.trackingNumber !== orderPackage?.paymentList?.deliveredPackages?.trackingNumber) {
              cost = (pkg?.deliveredPackages.exiosPrice * pkg.deliveredPackages.weight.total) * p.rate;
              paidAmount -= cost;
            }
          }
        })

        if (p.currency === "USD") {
          cost = orderPackage?.paymentList?.deliveredPackages.exiosPrice * orderPackage?.paymentList?.deliveredPackages.weight.total;
          paidAmount = paidAmount > cost ? cost : paidAmount;
          orderUSD += paidAmount;
        } else if (p.currency === "LYD") {
          orderLYD += paidAmount;
        }
      } else {
        if (p.currency === "USD") {
          orderUSD += p.receivedAmount;
        } else if (p.currency === "LYD") {
          orderLYD += p.receivedAmount;
        }
      }
    });

    return { orderUSD, orderLYD, rateSum, rateCount };
  };

  // Old expenses and accounting bills in one list, newest first; cancelled bills only on request
  const rows: Row[] = useMemo(() => {
    const fromBills: Row[] = bills.map((bill) => ({
      key: bill._id, date: bill.day, description: [categoryLabel(bill.costCategory), bill.description].filter(Boolean).join(' · '), supplier: bill.vendor, amount: bill.amount, currency: bill.currency,
      usd: (bill.usd || 0) / 100, paidFrom: bill.paid ? bill.paidFrom || 'Paid' : 'Owed to supplier', legacy: false, canceled: bill.status === 'canceled', bill,
    }));
    const fromLegacy: Row[] = legacy.map((exp) => ({
      key: exp._id, date: exp.date, description: exp.description, supplier: '', amount: exp.amount, currency: exp.currency, usd: legacyUsd(exp), legacy: true,
    }));
    return [...fromBills, ...fromLegacy]
      .filter((row) => showCanceled || !row.canceled)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, legacy, showCanceled]);

  const { totalUsd, missingRateCount, count } = useMemo(() => {
    const active = rows.filter((row) => !row.canceled);
    return {
      totalUsd: active.reduce((sum, row) => sum + (row.usd || 0), 0),
      missingRateCount: active.filter((row) => row.usd === undefined).length,
      count: active.length,
    };
  }, [rows]);

  const handleDownload = async () => {
    const orders = inventory.orders || [];
    setReportProgress({ done: 0, total: orders.length });

    try {
      // Fetch payments a few packages at a time instead of one by one; results keep the package order
      const received: Awaited<ReturnType<typeof getPackageReceived>>[] = new Array(orders.length);
      let nextIndex = 0;
      let done = 0;
      const worker = async () => {
        while (nextIndex < orders.length) {
          const index = nextIndex++;
          received[index] = await getPackageReceived(orders[index]);
          done++;
          setReportProgress({ done, total: orders.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(REPORT_CONCURRENCY, orders.length) }, worker));

      const data: any[] = [
        [
          inventory.inventoryFinishedDate ? moment(inventory.inventoryFinishedDate).format("DD/MM/YYYY") : "",
          "",
          "",
          inventory.shippedCountry,
          "",
          "",
          inventory.voyage
        ],
        [],
        [
          "العدد",
          "اسم الزبون",
          "رمز العميل",
          "كود تتبع Exios",
          "رقم تتبع الصين",
          "وزن/حجم",
          "نوع القياس",
          "$ السعر المحسوب",
          "$ تكلفة اكسيوس",
          "Received Amount LYD",
          "Received Amount USD"
        ]
      ];

      let totalReceivedUSD = 0;
      let totalReceivedLYD = 0;
      let avgRateOfPayments = 0;
      let paymentCount = 0;

      orders.forEach((orderPackage: any, i: number) => {
        const { orderUSD, orderLYD, rateSum, rateCount } = received[i];
        totalReceivedUSD += orderUSD;
        totalReceivedLYD += orderLYD;
        avgRateOfPayments += rateSum;
        paymentCount += rateCount;

        data.push([
          i + 1,
          orderPackage.customerInfo.fullName,
          orderPackage.user.customerId,
          orderPackage.orderId,
          orderPackage.paymentList.deliveredPackages.trackingNumber,
          orderPackage.paymentList.deliveredPackages.weight.total,
          orderPackage.paymentList.deliveredPackages.weight.measureUnit,
          orderPackage.paymentList.deliveredPackages.exiosPrice,
          calculateMinTotalPrice(
            orderPackage.paymentList.deliveredPackages.exiosPrice,
            orderPackage.paymentList.deliveredPackages.weight.total,
            inventory.shippedCountry,
            orderPackage.paymentList.deliveredPackages.weight.measureUnit
          ),
          orderLYD,
          orderUSD
        ]);
      });

      // Costs section: every cost of the trip in dollars (bills at their posted value)
      data.push([], ["📊 Expenses Details"]);
      data.push(["Date", "Supplier", "Description", "Amount", "Currency", "USD Equivalent", "Paid from"]);
      rows.filter((row) => !row.canceled).forEach((row) => {
        data.push([
          moment(row.date).format("DD/MM/YYYY"),
          row.legacy ? 'Before accounting' : row.supplier,
          row.description,
          row.amount,
          row.currency,
          row.usd === undefined ? '' : Number(row.usd.toFixed(2)),
          row.legacy ? '' : row.paidFrom
        ]);
      });

      data.push([]);
      data.push(["Total USD Equivalent Expenses", Number(totalUsd.toFixed(2))]);

      // Received totals
      data.push([]);
      data.push(["Total Received USD", totalReceivedUSD]);
      data.push(["Total Received LYD", totalReceivedLYD]);

      const avgRate = (avgRateOfPayments / paymentCount) || 0;
      const totalReceivedUSDConverted =
        totalReceivedUSD + (avgRate > 0 ? totalReceivedLYD / avgRate : 0);

      data.push(["Total Received USD Equivalent", totalReceivedUSDConverted.toFixed(2)]);
      data.push(["AVG LYD Rate", avgRate.toFixed(2)]);

      const profitLoss = totalReceivedUSDConverted - totalUsd;
      data.push([]);
      data.push([
        profitLoss >= 0 ? "Profit (USD)" : "Loss (USD)",
        profitLoss.toFixed(2)
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      worksheet["!cols"] = [
        { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, toExcelSheetName(inventory.voyage, 'Report'));
      XLSX.writeFile(workbook, `${toFileName(inventory.voyage, 'inventory')}_Report.xlsx`);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Could not build the report. Try again.', isError: true });
    } finally {
      setReportProgress(null);
    }
  };

  const payAccount = accounts.find((a) => a._id === form.payFrom);
  // Paid on the spot: the cost is in the currency of the account that paid it
  const currency = payAccount ? payAccount.currency : form.currency;
  const typedNewVendor = !form.vendor && form.vendorText.trim().length > 1;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.vendor && !typedNewVendor) {
      setFormError("Choose the supplier, or type the name of a new one.");
      return;
    }
    if (!amount || amount <= 0) {
      setFormError("Amount must be more than 0.");
      return;
    }
    setFormError(undefined);
    setSaving(true);
    try {
      await sys.post(`acc/trips/${inventoryId}/costs`, {
        vendorId: form.vendor?._id,
        vendorName: form.vendor ? undefined : form.vendorText.trim(),
        description: form.description.trim(),
        costCategory: form.costCategory,
        amount,
        currency,
        payFromAccountId: form.payFrom || undefined,
        rate: !payAccount && currency !== 'USD' && Number(form.rate) > 0 ? Number(form.rate) : undefined,
        day: form.day,
        idempotencyKey: key.current,
      });
      key.current = newKey();
      setToast({ message: form.payFrom ? 'Cost added and paid' : 'Cost added, owed to the supplier' });
      setForm({ ...emptyForm(), payFrom: form.payFrom, currency: form.currency, costCategory: form.costCategory });
      if (!form.vendor) fetchOptions();
      await fetchCosts();
    } catch (err) {
      setFormError(errorText(err, "Could not save the cost. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      setIsCanceling(true);
      await sys.post(`acc/bills/${cancelTarget._id}/cancel`, { reason: 'Removed from the trip page' });
      setCancelTarget(null);
      setToast({ message: 'Cost cancelled' });
      await fetchCosts();
    } catch (error) {
      setToast({ message: errorText(error, 'Could not cancel the cost.'), isError: true });
      setCancelTarget(null);
    } finally {
      setIsCanceling(false);
    }
  };

  const today = todayLibya();

  return (
    <section className="inv-card" style={{ marginTop: 32 }} aria-labelledby="flight-expenses-title">
      <div className="inv-card-head">
        <div>
          <h2 id="flight-expenses-title">{isDomestic ? 'Transport cost' : 'Flight expenses'}</h2>
          <p>
            {isDomestic
              ? 'What was paid to move these packages to the other office. It is an expense of this month, not shared over the packages.'
              : 'Costs of this voyage, shared over its packages by weight. The report adds what customers paid for its packages.'}
          </p>
        </div>
        <button
          type="button"
          className="inv-btn is-ghost"
          onClick={handleDownload}
          disabled={!!reportProgress}
        >
          {reportProgress ? (
            <>
              <CircularProgress size={14} />
              Preparing {reportProgress.done} / {reportProgress.total}
            </>
          ) : (
            <>
              <Download size={16} strokeWidth={2} />
              Download report
            </>
          )}
        </button>
      </div>

      <div className="inv-tiles">
        <div className="inv-tile">
          <span>All costs in USD</span>
          <strong>{formatNumber(totalUsd)}<small>USD</small></strong>
        </div>
        <div className="inv-tile">
          <span>Costs</span>
          <strong>{count}</strong>
        </div>
      </div>

      {missingRateCount > 0 &&
        <div className="inv-warn-note">
          {missingRateCount === 1 ? '1 old LYD expense has' : `${missingRateCount} old LYD expenses have`} no rate, so {missingRateCount === 1 ? 'it is' : 'they are'} left out of the USD total.
        </div>
      }

      <form className="inv-exp-form" onSubmit={handleSubmit} noValidate>
        <div className="inv-field">
          <FieldLabel required>Supplier</FieldLabel>
          <Autocomplete
            size="small"
            freeSolo
            options={vendors}
            value={form.vendor}
            inputValue={form.vendorText}
            getOptionLabel={(option: any) => (typeof option === 'string' ? option : option?.name || '')}
            isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
            onInputChange={(_, text) => setForm((f) => ({ ...f, vendorText: text }))}
            onChange={(_, vendor: any) => setForm((f) => ({ ...f, vendor: vendor && typeof vendor !== 'string' ? vendor : null }))}
            renderInput={(params) => <TextField {...params} placeholder="Carrier, customs agent..." helperText={typedNewVendor ? 'Will be added as a new supplier' : undefined} />}
          />
        </div>

        <div className="inv-field">
          <FieldLabel required>Kind of cost</FieldLabel>
          <FormControl size="small" fullWidth>
            <Select value={form.costCategory} onChange={(e) => setForm({ ...form, costCategory: String(e.target.value) })} inputProps={{ 'aria-label': 'Kind of cost' }}>
              {COST_CATEGORIES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
        </div>

        <div className="inv-field is-description">
          <FieldLabel>Description</FieldLabel>
          <TextField
            size="small"
            fullWidth
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Freight, clearance, fuel..."
            inputProps={{ dir: 'auto', 'aria-label': 'Description' }}
          />
        </div>

        <div className="inv-field">
          <FieldLabel required>Paid from</FieldLabel>
          <FormControl size="small" fullWidth>
            <Select value={form.payFrom} displayEmpty onChange={(e) => setForm({ ...form, payFrom: String(e.target.value) })} inputProps={{ 'aria-label': 'Paid from' }}>
              <MenuItem value="">Not paid yet (owed to the supplier)</MenuItem>
              {accounts.map((a) => <MenuItem key={a._id} value={a._id}>{a.name} ({a.currency})</MenuItem>)}
            </Select>
          </FormControl>
        </div>

        <div className="inv-field">
          <FieldLabel required>Amount</FieldLabel>
          <div className="inv-money">
            <TextField
              size="small"
              fullWidth
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              onWheel={(event: any) => event.target.blur()}
              inputProps={{ inputMode: 'decimal', step: .01, min: 0, 'aria-label': 'Amount' }}
            />
            <FormControl size="small">
              <Select
                value={currency}
                disabled={!!payAccount}
                onChange={(e) => setForm({ ...form, currency: String(e.target.value) })}
                inputProps={{ 'aria-label': 'Currency' }}
              >
                {(currencies.length ? currencies : [{ code: 'USD' }, { code: 'LYD' }]).map((c: any) => <MenuItem key={c.code} value={c.code}>{c.code}</MenuItem>)}
              </Select>
            </FormControl>
          </div>
        </div>

        {!payAccount && currency !== 'USD' && (
          <div className="inv-field">
            <FieldLabel note="blank = that day's rate">Rate</FieldLabel>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              onWheel={(event: any) => event.target.blur()}
              inputProps={{ inputMode: 'decimal', step: .0001, min: 0, 'aria-label': 'Rate' }}
            />
          </div>
        )}

        <div className="inv-field">
          <FieldLabel required>Date</FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="date"
            value={form.day}
            onChange={(e) => setForm({ ...form, day: e.target.value })}
            inputProps={{ max: today, 'aria-label': 'Date' }}
          />
        </div>

        <div className="inv-exp-actions">
          <button type="submit" className="inv-btn is-primary" disabled={saving}>
            {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : (<><Plus size={16} strokeWidth={2} /> Add</>)}
          </button>
        </div>

        {formError &&
          <div className="inv-error" role="alert" style={{ gridColumn: '1 / -1' }}>{formError}</div>
        }
      </form>

      <div className="d-flex justify-content-end mt-2">
        <label style={{ fontSize: '0.85rem', color: '#5b6673', cursor: 'pointer' }}>
          <input type="checkbox" checked={showCanceled} onChange={(e) => setShowCanceled(e.target.checked)} style={{ marginInlineEnd: 6 }} />
          Show cancelled
        </label>
      </div>

      {loading && rows.length === 0 ? (
        <div className="inv-skeleton" aria-busy="true"><i className="is-short" /></div>
      ) : rows.length === 0 ? (
        <div className="inv-empty">
          <Receipt size={28} strokeWidth={1.5} />
          <strong>No costs yet</strong>
          <p>Add freight, customs, clearance and other voyage costs above.</p>
        </div>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Description</th>
                <th className="is-num">Amount</th>
                <th className="is-num">In USD</th>
                <th>Paid from</th>
                <th className="is-actions"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} style={row.canceled ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{moment(row.date).format("DD/MM/YYYY")}</td>
                  <td dir="auto">{row.legacy ? <span className="is-muted">Before accounting</span> : row.supplier}</td>
                  <td className="inv-exp-desc" dir="auto">{row.description}</td>
                  <td className="is-num">{formatNumber(row.amount)} {row.currency}</td>
                  <td className="is-num">{row.usd === undefined ? <span className="is-muted">-</span> : formatNumber(row.usd)}</td>
                  <td>{row.legacy ? <span className="is-muted">-</span> : row.paidFrom}</td>
                  <td className="is-actions">
                    {/* The person who entered a cost can take it back the same day; later the accountant does */}
                    {!row.legacy && !row.canceled && row.bill && moment(row.bill.createdAt).format('YYYY-MM-DD') === today && (
                      <button type="button" className="inv-icon-btn is-danger" onClick={() => setCancelTarget(row.bill!)} aria-label="Cancel cost" title="Cancel">
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="is-num">{formatNumber(totalUsd)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog
        open={!!cancelTarget}
        onClose={() => !isCanceling && setCancelTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel this cost?</DialogTitle>
        <DialogContent sx={{ fontSize: '0.9rem', color: '#5b6673' }}>
          <span dir="auto">{cancelTarget?.vendor} · {cancelTarget?.description}</span>, {cancelTarget && formatNumber(cancelTarget.amount)} {cancelTarget?.currency}.
          Its accounting entry is reversed{cancelTarget?.paid ? ' and the money goes back to the account that paid it' : ''}.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button type="button" className="inv-btn is-ghost" onClick={() => setCancelTarget(null)} disabled={isCanceling}>Keep it</button>
          <button type="button" className="inv-btn is-danger-solid" onClick={handleCancel} disabled={isCanceling}>
            {isCanceling ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Cancel cost'}
          </button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setToast(null)}
      >
        <Alert severity={toast?.isError ? 'error' : 'success'} variant="filled" onClose={() => setToast(null)}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </section>
  );
};

export default InventoryExpenses;
