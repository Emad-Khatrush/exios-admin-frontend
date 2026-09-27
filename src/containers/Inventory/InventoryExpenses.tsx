import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Alert,
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
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import api from "../../api";
import moment from "moment";
import { calculateMinTotalPrice, toExcelSheetName, toFileName } from "../../utils/methods";
import * as XLSX from 'xlsx';
import { CircleAlert, Download, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { FieldLabel } from "./InventoryFields";

import './InventoryForm.scss';

interface Expense {
  _id?: string;
  description: string;
  amount: number;
  currency: "USD" | "LYD";
  rate?: number;
  date: string;
}

// The form keeps numbers as text so fields can be empty while typing
interface ExpenseForm {
  description: string;
  amount: string;
  currency: "USD" | "LYD";
  rate: string;
  date: string;
}

interface Props {
  inventoryId: string;
  inventory: any;
}

const emptyForm = (): ExpenseForm => ({
  description: "",
  amount: "",
  currency: "USD",
  rate: "",
  date: new Date().toISOString()
});

// How many package payment lookups run at once while building the report
const REPORT_CONCURRENCY = 6;

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

const toUsd = (exp: Expense) => {
  if (exp.currency === "USD") return exp.amount;
  return exp.rate && exp.rate > 0 ? exp.amount / exp.rate : undefined;
};

const InventoryExpenses: React.FC<Props> = ({ inventoryId, inventory }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [formError, setFormError] = useState<string>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportProgress, setReportProgress] = useState<{ done: number, total: number } | null>(null);
  const [toast, setToast] = useState<{ message: string, isError?: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          "$ سعر التكلفة",
          "$ تكلفة اكسيوس",
          "$ اجمالي التكلفة",
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
          inventory.costPrice,
          calculateMinTotalPrice(
            orderPackage.paymentList.deliveredPackages.exiosPrice,
            orderPackage.paymentList.deliveredPackages.weight.total,
            inventory.shippedCountry,
            orderPackage.paymentList.deliveredPackages.weight.measureUnit
          ),
          (orderPackage.paymentList?.deliveredPackages?.weight?.total *
            inventory?.costPrice) || 0,
          orderLYD,
          orderUSD
        ]);
      });

      // Expenses section
      data.push([], ["📊 Expenses Details"]);
      data.push([
        "Date",
        "Description",
        "Amount",
        "Currency",
        "Rate (if LYD)",
        "USD Equivalent"
      ]);

      let reportTotalUSD = 0;
      let reportTotalLYD = 0;
      let reportTotalUSDConverted = 0;

      // Use the list on screen so expenses added or removed since the page opened are included
      expenses.forEach((exp: any) => {
        let usdEquivalent = 0;
        if (exp.currency === "USD") {
          reportTotalUSD += exp.amount;
          usdEquivalent = exp.amount;
        } else if (exp.currency === "LYD") {
          reportTotalLYD += exp.amount;
          if (exp.rate && exp.rate > 0) {
            usdEquivalent = exp.amount / exp.rate;
            reportTotalUSDConverted += exp.amount / exp.rate;
          }
        }
        if (exp.currency === "USD") {
          reportTotalUSDConverted += exp.amount;
        }

        data.push([
          moment(exp.date).format("DD/MM/YYYY"),
          exp.description,
          exp.amount,
          exp.currency,
          exp.currency === "LYD" ? exp.rate || "" : "",
          usdEquivalent
        ]);
      });

      // Totals
      data.push([]);
      data.push(["Total USD Expenses", reportTotalUSD]);
      data.push(["Total LYD Expenses", reportTotalLYD]);
      data.push(["Total USD Equivalent Expenses", reportTotalUSDConverted]);

      // Received totals
      data.push([]);
      data.push(["Total Received USD", totalReceivedUSD]);
      data.push(["Total Received LYD", totalReceivedLYD]);

      // Convert LYD received to USD using average rate from expenses
      const avgRate = (avgRateOfPayments / paymentCount) || 0;

      const totalReceivedUSDConverted =
        totalReceivedUSD + (avgRate > 0 ? totalReceivedLYD / avgRate : 0);

      data.push(["Total Received USD Equivalent", totalReceivedUSDConverted.toFixed(2)]);
      data.push(["AVG LYD Rate", avgRate.toFixed(2)]);

      // Profit or loss
      const profitLoss = totalReceivedUSDConverted - reportTotalUSDConverted;
      data.push([]);
      data.push([
        profitLoss >= 0 ? "Profit (USD)" : "Loss (USD)",
        profitLoss.toFixed(2)
      ]);

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 }
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

  const fetchExpenses = async (needFetch = false) => {
    setLoading(true);
    try {
      if (needFetch) {
        const res = await api.get(`inventory/${inventoryId}`);
        setExpenses(res.data?.expenses || []);
      } else {
        setExpenses(inventory.expenses || []);
      }
    } catch (error) {
      console.error(error);
      setToast({ message: 'Could not load expenses. Refresh the page.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(form.amount);
    const rate = form.rate ? parseFloat(form.rate) : undefined;

    if (!form.description.trim()) {
      setFormError("Add a description.");
      return;
    }
    if (!amount || amount <= 0) {
      setFormError("Amount must be more than 0.");
      return;
    }
    if (!form.date) {
      setFormError("Pick a date.");
      return;
    }

    const payload: Expense = {
      description: form.description.trim(),
      amount,
      currency: form.currency,
      rate: form.currency === "LYD" ? rate : undefined,
      date: form.date
    };

    setFormError(undefined);
    setSaving(true);
    try {
      if (editingId) {
        await api.update(`inventory/${inventoryId}/expenses`, { ...payload, editingId });
      } else {
        await api.post(`inventory/${inventoryId}/expenses`, payload);
      }
      setToast({ message: editingId ? 'Expense updated' : 'Expense added' });
      resetForm();
      await fetchExpenses(true);
    } catch (err) {
      console.error(err);
      setFormError("Could not save the expense. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      setIsDeleting(true);
      await api.delete(`inventory/${inventoryId}/expenses`, { expenseId: deleteTarget._id });
      if (editingId === deleteTarget._id) resetForm();
      setDeleteTarget(null);
      setToast({ message: 'Expense deleted' });
      await fetchExpenses(true);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Could not delete the expense. Try again.', isError: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setFormError(undefined);
    setEditingId(null);
  };

  const startEdit = (expense: Expense) => {
    setForm({
      description: expense.description || "",
      amount: String(expense.amount ?? ""),
      currency: expense.currency,
      rate: expense.rate ? String(expense.rate) : "",
      date: expense.date
    });
    setFormError(undefined);
    setEditingId(expense._id || null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Totals calculation
  const { totalUSD, totalLYD, totalUSDConverted, missingRateCount } = useMemo(() => {
    let usd = 0;
    let lyd = 0;
    let usdFromLYD = 0;
    let missingRate = 0;

    expenses.forEach((exp) => {
      if (exp.currency === "USD") {
        usd += exp.amount;
      } else if (exp.currency === "LYD") {
        lyd += exp.amount;
        if (exp.rate && exp.rate > 0) {
          usdFromLYD += exp.amount / exp.rate;
        } else {
          missingRate++;
        }
      }
    });

    return {
      totalUSD: usd,
      totalLYD: lyd,
      totalUSDConverted: usd + usdFromLYD,
      missingRateCount: missingRate
    };
  }, [expenses]);

  const isLyd = form.currency === "LYD";

  return (
    <section className="inv-card" style={{ marginTop: 32 }} aria-labelledby="flight-expenses-title">
      <div className="inv-card-head">
        <div>
          <h2 id="flight-expenses-title">Flight expenses</h2>
          <p>Costs of this voyage. The report adds what customers paid for its packages.</p>
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
          <span>Total USD</span>
          <strong>{formatNumber(totalUSD)}<small>USD</small></strong>
        </div>
        <div className="inv-tile">
          <span>Total LYD</span>
          <strong>{formatNumber(totalLYD)}<small>LYD</small></strong>
        </div>
        <div className="inv-tile">
          <span>All expenses in USD</span>
          <strong>{formatNumber(totalUSDConverted)}<small>USD</small></strong>
        </div>
        <div className="inv-tile">
          <span>Expenses</span>
          <strong>{expenses.length}</strong>
        </div>
      </div>

      {missingRateCount > 0 &&
        <div className="inv-warn-note">
          <CircleAlert size={16} strokeWidth={2} />
          {missingRateCount === 1 ? '1 LYD expense has' : `${missingRateCount} LYD expenses have`} no rate, so {missingRateCount === 1 ? 'it is' : 'they are'} left out of the USD total.
        </div>
      }

      <form
        ref={formRef}
        className={`inv-exp-form ${editingId ? 'is-editing' : ''}`}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="inv-field is-description">
          <FieldLabel required>{editingId ? 'Edit description' : 'Description'}</FieldLabel>
          <TextField
            size="small"
            fullWidth
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            inputProps={{ dir: 'auto', 'aria-label': 'Description' }}
          />
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
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as "USD" | "LYD" })}
                inputProps={{ 'aria-label': 'Currency' }}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="LYD">LYD</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        <div className="inv-field">
          <FieldLabel note={isLyd ? undefined : 'LYD only'}>Rate</FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={isLyd ? form.rate : ''}
            disabled={!isLyd}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
            onWheel={(event: any) => event.target.blur()}
            inputProps={{ inputMode: 'decimal', step: .01, min: 0, 'aria-label': 'Rate' }}
          />
        </div>

        <div className="inv-field">
          <FieldLabel required>Date</FieldLabel>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              inputFormat="dd/MM/yyyy"
              value={form.date || null}
              onChange={(value: any) =>
                setForm({ ...form, date: value && !isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : "" })
              }
              renderInput={(params) => <TextField {...params} size="small" fullWidth />}
            />
          </LocalizationProvider>
        </div>

        <div className="inv-exp-actions">
          {editingId && (
            <button type="button" className="inv-btn is-ghost" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          )}
          <button type="submit" className="inv-btn is-primary" disabled={saving}>
            {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : (
              <>
                {!editingId && <Plus size={16} strokeWidth={2} />}
                {editingId ? 'Save' : 'Add'}
              </>
            )}
          </button>
        </div>

        {formError &&
          <div className="inv-error" role="alert" style={{ gridColumn: '1 / -1' }}>{formError}</div>
        }
      </form>

      {loading && expenses.length === 0 ? (
        <div className="inv-skeleton" aria-busy="true"><i className="is-short" /></div>
      ) : expenses.length === 0 ? (
        <div className="inv-empty">
          <Receipt size={28} strokeWidth={1.5} />
          <strong>No expenses yet</strong>
          <p>Add fuel, customs, clearance and other voyage costs above.</p>
        </div>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="is-num">Amount</th>
                <th className="is-num">Rate</th>
                <th className="is-num">In USD</th>
                <th className="is-actions"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => {
                const usd = toUsd(exp);
                return (
                  <tr key={exp._id} className={editingId === exp._id ? 'is-editing' : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{moment(exp.date).format("DD/MM/YYYY")}</td>
                    <td className="inv-exp-desc" dir="auto">{exp.description}</td>
                    <td className="is-num">{formatNumber(exp.amount)} {exp.currency}</td>
                    <td className="is-num">
                      {exp.currency === "LYD" ? (exp.rate || <span className="is-muted">Missing</span>) : <span className="is-muted">-</span>}
                    </td>
                    <td className="is-num">{usd === undefined ? <span className="is-muted">-</span> : formatNumber(usd)}</td>
                    <td className="is-actions">
                      <button type="button" className="inv-icon-btn" onClick={() => startEdit(exp)} aria-label="Edit expense" title="Edit">
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                      <button type="button" className="inv-icon-btn is-danger" onClick={() => setDeleteTarget(exp)} aria-label="Delete expense" title="Delete">
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="is-num">{formatNumber(totalUSDConverted)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this expense?</DialogTitle>
        <DialogContent sx={{ fontSize: '0.9rem', color: '#5b6673' }}>
          <span dir="auto">{deleteTarget?.description}</span>, {deleteTarget && formatNumber(deleteTarget.amount)} {deleteTarget?.currency}.
          This can't be undone.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button type="button" className="inv-btn is-ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</button>
          <button type="button" className="inv-btn is-danger-solid" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Delete expense'}
          </button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
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
