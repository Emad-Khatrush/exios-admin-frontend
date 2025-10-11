import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { format } from "date-fns";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import api from "../../api";
import moment from "moment";
import { calculateMinTotalPrice } from "../../utils/methods";
import * as XLSX from 'xlsx';

interface Expense {
  _id?: string;
  description: string;
  amount: number;
  currency: "USD" | "LYD";
  rate?: number;
  date: string;
}

interface Props {
  inventoryId: string;
  inventory: any;
}

const InventoryExpenses: React.FC<Props> = ({ inventoryId, inventory }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Expense>({
    description: "",
    amount: 0,
    currency: "USD",
    rate: undefined,
    date: new Date().toISOString()
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  const handleDownload = async () => {
    const data: any[] = [
      [
        moment(inventory.inventoryFinishedDate).format("DD/MM/YYYY"),
        "",
        "",
        inventory.shippedCountry,
        "",
        "",
        inventory.voyage,
        "",
        "",
        `${inventory.voyageAmount} ${inventory.voyageCurrency} تكلفة الرحلة:`
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

    // Loop through orders and fetch payment info
    for (let i = 0; i < inventory.orders.length; i++) {
      const orderPackage = inventory.orders[i];

      const paymentHistoryResponse = (
        await api.get(`order/${orderPackage._id}/payments`)
      )?.data?.results;

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
      
      // Calculate totals per order
      let orderUSD = 0;
      let orderLYD = 0;

      // eslint-disable-next-line no-loop-func
      paymentsOfPackage.forEach((p: any) => {
        // Calculate AVG rate
        if (p.currency === 'LYD' && p?.rate !== undefined) {
          avgRateOfPayments += (p?.rate || 0);
          paymentCount++;
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

      totalReceivedUSD += orderUSD;
      totalReceivedLYD += orderLYD;

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
    }

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

    let totalUSD = 0;
    let totalLYD = 0;
    let totalUSDConverted = 0;

    inventory.expenses.forEach((exp: any) => {
      let usdEquivalent = 0;
      if (exp.currency === "USD") {
        totalUSD += exp.amount;
        usdEquivalent = exp.amount;
      } else if (exp.currency === "LYD") {
        totalLYD += exp.amount;
        if (exp.rate && exp.rate > 0) {
          usdEquivalent = exp.amount / exp.rate;
          totalUSDConverted += exp.amount / exp.rate;
        }
      }
      if (exp.currency === "USD") {
        totalUSDConverted += exp.amount;
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
    data.push(["Total USD Expenses", totalUSD]);
    data.push(["Total LYD Expenses", totalLYD]);
    data.push(["Total USD Equivalent Expenses", totalUSDConverted]);

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
    const profitLoss = totalReceivedUSDConverted - totalUSDConverted;
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
    XLSX.utils.book_append_sheet(workbook, worksheet, inventory.voyage);
    XLSX.writeFile(workbook, `${inventory.voyage}_Report.xlsx`);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.description || form.amount <= 0 || !form.date) {
      alert("Please fill all fields correctly.");
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await api.update(`inventory/${inventoryId}/expenses`, { ...form, editingId });
      } else {
        await api.post(`inventory/${inventoryId}/expenses`, form);
      }
      resetForm();
      fetchExpenses(true);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    await api.delete(`inventory/${inventoryId}/expenses`, { expenseId: id });
    fetchExpenses();
  };

  const resetForm = () => {
    setForm({
      description: "",
      amount: 0,
      currency: "USD",
      rate: undefined,
      date: new Date().toISOString()
    });
    setEditingId(null);
  };

  const startEdit = (expense: Expense) => {
    setForm(expense);
    setEditingId(expense._id || null);
  };

  // Totals calculation
  const { totalUSD, totalLYD, totalUSDConverted } = useMemo(() => {
    let usd = 0;
    let lyd = 0;
    let usdFromLYD = 0;

    expenses.forEach((exp) => {
      if (exp.currency === "USD") {
        usd += exp.amount;
      } else if (exp.currency === "LYD") {
        lyd += exp.amount;
        if (exp.rate && exp.rate > 0) {
          usdFromLYD += exp.amount / exp.rate;
        }
      }
    });

    return {
      totalUSD: usd,
      totalLYD: lyd,
      totalUSDConverted: usd + usdFromLYD
    };
  }, [expenses]);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Flight Expenses
      </Typography>

      <Button
        variant="contained"
        color="primary"
        onClick={handleDownload}
        sx={{ mb: 2 }}
      >
        Download Flight Report
      </Button>

      {/* Totals Summary */}
      {(totalLYD > 0 || totalUSDConverted > 0 || totalUSD > 0) && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            border: "1px solid #eee",
            borderRadius: 2,
            background: "#fafafa"
          }}
        >
          <Typography variant="body1">
            <strong>Total USD:</strong> {totalUSD.toLocaleString()} $
          </Typography>
          <Typography variant="body1">
            <strong>Total LYD:</strong> {totalLYD.toLocaleString()} LYD
          </Typography>
          <Typography variant="body1" color="primary">
            <strong>Total USD Equivalent:</strong> {totalUSDConverted.toLocaleString()} $
          </Typography>
        </Box>
      )}

      {/* Expense Form */}
      <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 3 }}>
        <TextField
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <TextField
          label="Amount"
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
        />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Currency</InputLabel>
          <Select
            value={form.currency}
            onChange={(e) =>
              setForm({ ...form, currency: e.target.value as "USD" | "LYD" })
            }
          >
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="LYD">LYD</MenuItem>
          </Select>
        </FormControl>
        {form.currency === "LYD" && (
          <TextField
            label="Rate"
            type="number"
            value={form.rate || ""}
            onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) })}
          />
        )}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Date"
            value={form.date}
            onChange={(value) =>
              setForm({ ...form, date: value ? value.toString() : "" })
            }
            renderInput={(params) => <TextField {...params} />}
          />
        </LocalizationProvider>
        <Button disabled={loading} variant="contained" color="primary" onClick={handleSubmit}>
          {editingId ? "Update" : "Add"}
        </Button>
        {editingId && (
          <Button variant="outlined" onClick={resetForm}>
            Cancel
          </Button>
        )}
      </Stack>

      {/* Expenses List */}
      {loading ? (
        <CircularProgress />
      ) : expenses.length === 0 ? (
        <Typography>No expenses found.</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell align="right"><strong>Amount</strong></TableCell>
                <TableCell align="center"><strong>Currency</strong></TableCell>
                <TableCell align="right"><strong>Rate</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((exp, idx) => (
                <TableRow
                  key={exp._id}
                  sx={{
                    backgroundColor: idx % 2 === 0 ? "#fafafa" : "white"
                  }}
                >
                  <TableCell style={{ direction: 'rtl' }}>{exp.description}</TableCell>
                  <TableCell align="right">{exp.amount.toLocaleString()}</TableCell>
                  <TableCell align="center">{exp.currency}</TableCell>
                  <TableCell align="right">
                    {exp.currency === "LYD" && exp.rate ? exp.rate : "-"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(exp.date), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => startEdit(exp)}>
                      <Edit />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDelete(exp._id!)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default InventoryExpenses;
