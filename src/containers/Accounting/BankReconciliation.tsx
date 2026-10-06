import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import { ArrowLeftRight, EyeOff, RotateCcw, Trash2, Upload } from 'lucide-react';
import api from '../../api';
import { CURRENCY_DECIMALS, acc, errorText } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { useBulk } from './bulk';
import { Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, StatusBadge, Sub } from './ui';
import { Mapping, ROLES, StatementRow, detect, readSheet, rowsFrom } from './bankImport';
import { RemotePicker, orderLabel, tripLabel, userLabel } from './shared';
import PurchaseMatchPicker from './PurchaseMatchPicker';
import BankReviewComparison, { ReviewField } from './BankReviewComparison';
import BankLineDetails from './BankLineDetails';

type Preview = {
  fileName: string
  kind: 'sheet' | 'pdf'
  cells?: any[][]
  headerRow: number
  mapping: Mapping
  rows: StatementRow[]
  // Rows left out, and rows whose sign was turned around, by position
  skip: Set<number>
  flip: Set<number>
  // A credit card statement prints spending as + and payments as -: the opposite of an account
  flipAll: boolean
  creditCard: boolean
  // The account chosen for each row (by position); rows without one are imported and left for later
  choices: Record<number, Choice>
}

// `link`: the purchase cost typed on an order that this line paid (kept while its account is unchanged)
type Choice = { accountId?: string, office?: string, notDuplicate?: boolean, byHand?: boolean, link?: any, vendorName?: string, ignore?: boolean, billId?: string, billAccepted?: boolean, confirmNewBill?: boolean, purchaseMatch?: any, purchaseSelection?: any }

const billLabel = (bill: any) => `${bill.number} · ${bill.orders?.map((o: any) => o.number).filter(Boolean).join('، ') || bill.vendorName || ''} · ${bill.amount} ${bill.currency} · ${bill.day}`;

// Where a suggestion came from, in words
const sourceText = (item: any) => (item.source === 'bill' ? 'سداد فاتورة مورد موجودة' : item.source === 'order' ? 'مربوط بطلبية' : item.source === 'rule' ? `قاعدة: ${item.keyword}` : 'مثل آخر مرة');

// Every row with the sign it will be imported with (skipped rows included, for the table)
const edited = (preview: Preview) => preview.rows
  .map((row, index) => ({ ...row, index, amount: (preview.flip.has(index) ? -1 : 1) * (preview.flipAll ? -1 : 1) * row.amount }));
const withEdits = (preview: Preview) => edited(preview).filter((row) => !preview.skip.has(row.index));

const STATUS_LABEL: Record<string, { text: string, tone: any }> = {
  new: { text: 'جديد', tone: 'info' },
  imported: { text: 'مستورد من قبل', tone: 'muted' },
  match: { text: 'مسجل في الدفاتر', tone: 'ok' },
  maybeDuplicate: { text: 'قد يكون مكرراً', tone: 'warn' },
};

// The first words of a statement text make a good rule keyword ("COMMISSION TRF 001" -> "commission trf")
const keywordOf = (text: string) => String(text || '').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');

const BankReconciliation = () => {
  const { accounts, offices } = useAccountingData();
  const banks = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);
  // Opens on the account last worked on (kept on this device only)
  const [accountId, setAccountId] = useState(() => { try { return localStorage.getItem('acc-bank-account') || ''; } catch { return ''; } });
  useEffect(() => { try { if (accountId) localStorage.setItem('acc-bank-account', accountId); } catch { /* storage may be blocked */ } }, [accountId]);
  // A remembered account that no longer exists is dropped
  useEffect(() => { if (accountId && banks.length && !banks.some((a) => a._id === accountId)) setAccountId(''); }, [banks, accountId]);
  const [data, setData] = useState<any>(null);
  const [suggested, setSuggested] = useState<Record<string, any>>({});
  const [rules, setRules] = useState<any[]>([]);
  const [filter, setFilter] = useState('unmatched');
  const [message, setMessage] = useState<any>(null);
  const [entryFor, setEntryFor] = useState<any>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [purchaseReview, setPurchaseReview] = useState<any>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // What the server says about each row of the file: imported before, in the books, or new and
  // where it would go
  const [classes, setClasses] = useState<any[] | null>(null);
  const [newRule, setNewRule] = useState<any>(null);
  // Several lines for one purchase typed on an order (spec v8)
  const [group, setGroup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const account = banks.find((a) => a._id === accountId);
  const currency = account?.currency || 'USD';
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const detailAccounts = useMemo(() => accounts.filter((a) => !a.isGroup && a.isActive && a._id !== accountId), [accounts, accountId]);

  const load = async () => {
    if (!accountId) return;
    try {
      setIsLoading(true);
      const [lines, hints, ruleList] = await Promise.all([
        acc.get('bank/lines', { accountId, lineStatus: filter || undefined }),
        acc.get('bank/suggestions', { accountId }),
        acc.get('bank/rules', { accountId }),
      ]);
      setData(lines.data);
      setSuggested(hints.data);
      setRules(ruleList.data.results);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [accountId, filter]);

  const run = async (action: () => Promise<any>, text: (res: any) => string) => {
    try {
      const res = await action();
      setMessage({ type: 'success', text: text(res.data) });
      await load();
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
      await load();
      return false;
    }
  };

  // ---- Import ----

  const openFile = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    try {
      if (/\.pdf$/i.test(file.name)) {
        const form = new FormData();
        form.append('file', file);
        // Sent as a file upload: the JSON client would label the file as JSON and the server would
        // try to read it as such. fetchFormData never throws; a refusal comes back as the body.
        const res: any = await api.fetchFormData('accounting/bank/parse-pdf', 'POST', form);
        if (res instanceof Error || !Array.isArray(res?.rows)) throw new Error(res?.message || 'تعذّرت قراءة الملف');
        setPreview({ fileName: file.name, kind: 'pdf', headerRow: 0, mapping: {}, rows: res.rows, skip: new Set(), flip: new Set(), creditCard: !!res.creditCard, flipAll: !!res.creditCard, choices: {} });
      } else {
        const cells = await readSheet(file);
        const { headerRow, mapping } = detect(cells);
        setPreview({ fileName: file.name, kind: 'sheet', cells, headerRow, mapping, rows: rowsFrom(cells, headerRow, mapping), skip: new Set(), flip: new Set(), creditCard: false, flipAll: false, choices: {} });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response ? errorText(err) : `تعذّرت قراءة الملف: ${err.message}` });
    }
  };

  const remap = (next: Partial<Preview>) => setPreview((current) => {
    if (!current?.cells) return current;
    const merged = { ...current, ...next };
    return { ...merged, rows: rowsFrom(current.cells, merged.headerRow, merged.mapping), skip: new Set(), flip: new Set(), choices: {} };
  });
  const toggleIn = (key: 'skip' | 'flip', index: number) => setPreview((current) => {
    if (!current) return current;
    const set = new Set(current[key]);
    if (set.has(index)) set.delete(index); else set.add(index);
    return { ...current, [key]: set };
  });

  // The rows are classified again whenever what would be imported changes (signs, columns)
  const signature = preview ? JSON.stringify(edited(preview).map((r) => [r.day, r.amount, r.description])) : '';
  useEffect(() => {
    if (!preview || !accountId || !preview.rows.length) { setClasses(null); return undefined; }
    let stale = false;
    const timer = window.setTimeout(() => {
      acc.post('bank/classify', { accountId, rows: edited(preview) })
        .then((res: any) => {
          if (stale) return;
          setClasses(res.data.results);
          // The suggested accounts fill the rows the person has not set by hand
          setPreview((current) => {
            if (!current) return current;
            const choices = { ...current.choices };
            res.data.results.forEach((item: any, index: number) => {
              if (choices[index]?.byHand) {
                choices[index] = { ...choices[index], billAccepted: false, purchaseMatch: undefined, purchaseSelection: undefined };
                return;
              }
              choices[index] = item.status === 'new' && item.account ? { accountId: item.account._id, office: item.office || undefined, link: item.link || undefined, vendorName: item.vendorName || undefined, billId: item.billId || undefined } : {};
            });
            return { ...current, choices };
          });
        })
        .catch((err: any) => { if (!stale) setMessage({ type: 'error', text: errorText(err) }); });
    }, 350);
    return () => { stale = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, accountId]);

  // Choosing an account for a row also fills the rows with the same text that have none yet
  const choose = (index: number, accountIdChosen: string) => setPreview((current) => {
    if (!current) return current;
    const choices = { ...current.choices, [index]: { ...current.choices[index], accountId: accountIdChosen || undefined, byHand: true, link: undefined, billId: undefined, billAccepted: false, purchaseMatch: undefined, purchaseSelection: undefined } };
    const key = keywordOf(current.rows[index].description).toLowerCase();
    if (accountIdChosen && key) {
      current.rows.forEach((row, other) => {
        const status = classes?.[other]?.status;
        if (other !== index && !choices[other]?.accountId && !choices[other]?.purchaseMatch && ['new', undefined].includes(status) && keywordOf(row.description).toLowerCase() === key) {
          choices[other] = { ...choices[other], accountId: accountIdChosen, byHand: true, link: undefined };
        }
      });
    }
    return { ...current, choices };
  });
  const toggleIgnore = (index: number) => setPreview((current) => (current
    ? { ...current, choices: { ...current.choices, [index]: { ...current.choices[index], ignore: !current.choices[index]?.ignore } } } : current));
  const markNotDuplicate = (index: number, value: boolean) => setPreview((current) => (current
    ? { ...current, choices: { ...current.choices, [index]: { ...current.choices[index], notDuplicate: value, byHand: true } } } : current));

  // A row is posted on import when it has an account, is new, and (if it may be in the books) was confirmed as different
  const willPost = (index: number) => {
    const status = classes?.[index]?.status;
    const choice = preview?.choices[index];
    if (classes?.[index]?.isRefund && !choice?.purchaseMatch) return false;
    if (classes?.[index]?.billCandidates?.length && !choice?.purchaseMatch && !choice?.confirmNewBill && !(choice?.billAccepted && choice?.billId)) return false;
    return !!(choice?.accountId || choice?.purchaseMatch || (choice?.billAccepted && choice?.billId)) && !choice?.ignore && (status === 'new' || (status === 'maybeDuplicate' && choice?.notDuplicate));
  };

  const importPreview = async () => {
    const rows = withEdits(preview!).map((row) => {
      const choice = preview!.choices[row.index] || {};
      return {
        day: row.day, description: row.description, reference: row.reference, amount: row.amount, balanceAfter: row.balanceAfter,
        // Dollars sold for lira: what the other account received
        counterAmount: (row as any).counterAmount, counterCurrency: (row as any).counterCurrency,
        originalAmount: row.originalAmount, originalCurrency: row.originalCurrency, settlementUsd: row.settlementUsd, exchangeRate: row.exchangeRate,
        movementKind: row.movementKind,
        ...(choice.ignore ? { ignore: true } : {}),
        ...(willPost(row.index) ? { purchaseMatch: choice.purchaseMatch, counterAccountId: choice.billAccepted ? undefined : choice.accountId, office: choice.office || account?.office || undefined, confirmNotDuplicate: !!choice.notDuplicate, link: choice.billAccepted ? undefined : choice.link || undefined, vendorName: choice.vendorName || undefined, billId: choice.billAccepted ? choice.billId : undefined, confirmNewBill: !!choice.confirmNewBill } : {}),
      };
    });
    if (!rows.length) return setMessage({ type: 'error', text: 'لا سطور للاستيراد.' });
    const ok = await run(() => acc.post('bank/import', { accountId, rows }), (d) => [
      `استُورد ${d.count} سطراً`,
      d.skipped ? `تُجوهل ${d.skipped} مستورداً من قبل` : '',
      d.matched ? `طُوبق ${d.matched} مع ما في الدفاتر` : '',
      d.posted ? `رُحِّل ${d.posted} على حساباتها` : '',
      d.notPosted?.length ? `لم يُرحَّل ${d.notPosted.length}: ${d.notPosted.slice(0, 3).map((n: any) => `${n.description} (${n.reason})`).join('؛ ')}` : '',
    ].filter(Boolean).join('، ') + '.');
    if (ok) { setPreview(null); setClasses(null); }
  };

  // ---- Posting ----

  const postLine = (line: any, input: any) => acc.post(`bank/lines/${line._id}/entry`, input);

  const bulk = useBulk<any>({
    rows: data?.lines || [],
    rowKey: (row) => row._id,
    rowLabel: (row) => `${row.day} ${row.description}`,
    onDone: load,
    actions: [
      {
        key: 'post', label: 'ترحيل على الحساب المقترح', done: 'رُحِّل',
        applies: (row) => row.lineStatus === 'unmatched' && !!suggested[row._id]?.account && !suggested[row._id]?.requiresConfirmation && !suggested[row._id]?.duplicates?.length,
        run: (row) => postLine(row, { counterAccountId: suggested[row._id].account._id, office: suggested[row._id].office || account?.office || undefined, link: suggested[row._id].link || undefined, vendorName: suggested[row._id].vendorName || undefined, billId: suggested[row._id].billId || undefined }),
        confirm: (count) => `سيُرحَّل ${count} سطراً كلٌ على حسابه المقترح. السطور التي قد تكون مسجلة في الدفاتر لا تُرحَّل.`,
      },
      {
        key: 'ignore', label: 'تجاهل', done: 'تُجوهل', applies: (row) => row.lineStatus === 'unmatched',
        run: (row) => acc.post(`bank/lines/${row._id}/ignore`),
        confirm: (count) => `سيُعلَّم ${count} سطراً كمُتجاهَل فلا يظهر ضمن غير المطابق. يمكن التراجع لاحقاً.`,
      },
      {
        key: 'unignore', label: 'إرجاع لغير مطابق', done: 'أُعيد', applies: (row) => ['matched', 'ignored'].includes(row.lineStatus),
        run: (row) => acc.post(`bank/lines/${row._id}/unignore`),
        confirm: (count) => `سيعود ${count} سطراً إلى «غير مطابق»، وتُفك مطابقة ما كان مطابقاً منها.`,
      },
    ],
  });

  const openEntry = (row: any, hints = suggested, source = data) => {
    const hint = hints[row._id];
    const previous = new Set(row.historyEntryIds || []);
    const possible = (source?.unmatchedMovements || []).filter((movement: any) => !previous.has(movement._id) && hint?.duplicates?.some((candidate: any) => candidate._id === movement._id))
      .sort((a: any, b: any) => Math.abs(Date.parse(a.day) - Date.parse(row.day)) - Math.abs(Date.parse(b.day) - Date.parse(row.day)) || String(a._id).localeCompare(String(b._id)));
    setEntryFor({
      mode: possible.length ? 'ledger' : row.amount > 0 && (hint?.isRefund || row.movementKind === 'purchase_refund') ? 'refund' : row.amount < 0 && (hint?.billCandidates?.length || hint?.link) ? 'purchase' : 'new',
      selected: possible.length ? [possible[0]._id] : [],
      changeLedger: !possible.length,
      line: row, counterAccountId: hint?.account?._id || '', office: hint?.office || account?.office || '', description: row.description, link: hint?.link || undefined, vendorName: hint?.vendorName || '', billId: hint?.suggestedBillId || hint?.billId || '', billAccepted: false, confirmNewBill: false,
      remember: false, keyword: keywordOf(row.description), confirmNotDuplicate: !!row.postingAttempt,
    });
  };

  const saveEntry = async () => {
    if (reviewSaving) return;
    const { line, target, trip, order, partner, ...input } = entryFor;
    // A trip, an order or a customer's debt (lines of a partner's current account, spec 19.4)
    const routed = target === 'trip' ? { target, tripId: trip?._id } : target === 'order' ? { target, orderId: order?._id } : target === 'debt' ? { target, partnerId: partner?._id } : {};
    if (suggested[line._id]?.billCandidates?.length && !input.confirmNewBill && !(input.billAccepted && input.billId && !target)) {
      setMessage({ type: 'warning', text: 'راجع الفاتورة المقترحة ووافق على المطابقة، أو أكد أن هذه عملية جديدة.' });
      return;
    }
    setReviewSaving(true);
    try {
    const ok = await run(() => postLine(line, { ...input, ...routed,
      billId: input.billAccepted ? input.billId : undefined,
      ...(input.billAccepted && { counterAccountId: undefined, link: undefined }), office: input.office || undefined }), () => input.billAccepted ? 'سُجّل السداد على الفاتورة الأصلية دون إنشاء فاتورة جديدة.' : 'أُنشئ القيد.');
    if (ok) setEntryFor(null);
    } finally { setReviewSaving(false); }
  };

  const money = (value: number) => <Money value={value} currency={currency} decimals={decimals} />;
  const previewRows = preview ? withEdits(preview) : [];
  const included = previewRows;
  const totalIn = previewRows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = previewRows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
  const previewDays = previewRows.map(r => r.day).sort();
  const cardRefunds = previewRows.filter(r => r.amount > 0 && r.movementKind === 'purchase_refund').reduce((sum, r) => sum + r.amount, 0);
  const cardPayments = previewRows.filter(r => r.amount > 0 && r.movementKind === 'card_payment').reduce((sum, r) => sum + r.amount, 0);
  const unmatchedCount = (data?.lines || []).filter((l: any) => l.lineStatus === 'unmatched').length;
  const readyCount = (data?.lines || []).filter((l: any) => l.lineStatus === 'unmatched' && suggested[l._id]?.account && !suggested[l._id]?.requiresConfirmation && !suggested[l._id]?.duplicates?.length).length;
  const doubtCount = (data?.lines || []).filter((l: any) => l.lineStatus === 'unmatched' && suggested[l._id]?.duplicates?.length).length;

  return (
    <>
      {detailsId && <BankLineDetails key={detailsId} id={detailsId} onClose={() => setDetailsId(null)} onChanged={load} onReview={async (line) => {
        try {
          const [hints, lines] = await Promise.all([acc.get('bank/suggestions', { accountId }), acc.get('bank/lines', { accountId })]);
          setSuggested(hints.data); setDetailsId(null); openEntry(line, hints.data, lines.data);
        } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
      }} />}
      <PageHeader
        title="كشوف البنوك و Alipay"
        subtitle="ارفع كشف الحساب Excel أو PDF. ما هو مسجل في الدفاتر يُطابق تلقائياً، والباقي يُرحَّل إلى حسابه. السطر المستورد من قبل لا يُستورد مرتين، والسطر الذي أدخلته يدوياً لا يُسجَّل مرة ثانية."
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel>
        <FilterBar>
          <TextField select label="الحساب" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ minWidth: 300 }}>
            {banks.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
          </TextField>
          {accountId && <>
            <Button variant="contained" component="label" startIcon={<Upload size={16} />}>
              رفع كشف (Excel / PDF)
              <input hidden type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
            </Button>
            <Button variant="outlined" onClick={() => run(() => acc.post('bank/auto-match', { accountId }), (d) => `طُوبق ${d.matched} سطراً.`)}>مطابقة تلقائية</Button>
            <TextField select label="عرض" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 150 }}>
              <MenuItem value="">كل السطور</MenuItem>
              <MenuItem value="unmatched">غير مطابق</MenuItem>
              <MenuItem value="matched">مطابق</MenuItem>
              <MenuItem value="created_entry">أُنشئ له قيد</MenuItem>
              <MenuItem value="ignored">مُتجاهَل</MenuItem>
            </TextField>
          </>}
        </FilterBar>
        {!accountId && <div className="acc-empty">اختر بنكاً أو محفظة إلكترونية.</div>}
      </Panel>

      {accountId && data && (
        <StatGrid>
          <Stat label="الرصيد في الدفاتر" value={money(data.bookBalance.foreign)} tone="accent" />
          <Stat label="الرصيد حسب الكشف" value={data.statementBalance === null ? '-' : money(data.statementBalance)} tone={data.statementBalance !== null && data.statementBalance !== data.bookBalance.foreign ? 'warn' : undefined} hint={data.statementBalance !== null && data.statementBalance !== data.bookBalance.foreign ? 'الفرق هو ما لم يُعالج بعد' : undefined} />
          <Stat label="جاهز للترحيل" value={filter === 'unmatched' ? readyCount : '-'} hint={filter === 'unmatched' ? `من ${unmatchedCount} غير مطابق` : 'اعرض غير المطابق'} />
          <Stat label="قد يكون مكرراً" value={filter === 'unmatched' ? doubtCount : '-'} tone={doubtCount ? 'warn' : undefined} hint="له قيد بنفس المبلغ في الدفاتر" />
        </StatGrid>
      )}

      {accountId && (
        <Panel flush title="سطور الكشف" subtitle="حدّد السطور ثم «ترحيل على الحساب المقترح»، أو عالج كل سطر وحده.">
          {bulk.bar}
          {(() => {
            const picked = (data?.lines || []).filter((l: any) => bulk.selection.selected.has(l._id) && l.lineStatus === 'unmatched' && l.amount < 0);
            return picked.length > 0 && (
              <div className="px-3 pb-2">
                <Button size="small" variant="outlined" onClick={() => setGroup({ lines: picked, order: null, items: [], itemId: '', confirmDifference: false })}>
                  ربط المحدد ({picked.length}) بمشتريات طلب واحدة
                </Button>
              </div>
            );
          })()}
          <DataTable
            selection={bulk.selection}
            loading={isLoading || !data}
            rows={data?.lines || []}
            rowKey={(row: any) => row._id}
            rowTone={(row: any) => (row.lineStatus === 'ignored' ? 'muted' : undefined)}
            empty={{ title: 'لا توجد سطور هنا', hint: 'ارفع كشف الحساب لتبدأ.' }}
            columns={[
              { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr>, sortValue: (row: any) => row.day },
              {
                key: 'description', header: 'البيان', render: (row: any) => {
                  const hint = suggested[row._id];
                  return (
                    <>
                      {row.description}{row.reference && <span className="acc-muted"> · <Ltr>{row.reference}</Ltr></span>}
                      {(row.movementKind === 'purchase_refund' || hint?.isRefund) && <Sub><Badge tone="info">Refund — استرداد</Badge>{hint?.vendorName && <Sub>المورد: {hint.vendorName}</Sub>}{hint?.refundAccount && <Sub>حساب التكلفة المقترح: {hint.refundAccount.code} · {hint.refundAccount.name}</Sub>}{row.lineStatus === 'unmatched' && <Sub>لم يُرحّل بعد؛ اختر الفاتورة أو الريفاند الأصلي لاعتماد الربط.</Sub>}</Sub>}
                      {row.customerRefundId?.number && <Sub>ريفاند الطلبية: <Ltr>{row.customerRefundId.number}</Ltr> · لمحفظة العميل: <Ltr>{row.customerRefundId.walletUsd / 100} USD</Ltr></Sub>}
                      {row.pendingRefund && <Sub><Badge tone="warn">استرداد مرحّل قيد التحديد</Badge>يُربط لاحقاً من تبويب الريفاند داخل الطلبية؛ البنك استلم المبلغ بالفعل.</Sub>}
                      {row.matchedEntryIds?.length > 0 && <Sub>مطابق مع <Ltr>{row.matchedEntryIds.map((e: any) => e.number).join('، ')}</Ltr></Sub>}
                      {row.entryId && <Sub>القيد <Ltr>{row.entryId.number}</Ltr></Sub>}
                      {row.billId?.number && <Sub>الفاتورة <Open to={`/accounting/bills/${row.billId._id}`}><Ltr>{row.billId.number}</Ltr></Open></Sub>}
                      {row.orderId && <Sub>الطلبية <Open to={`/invoice/${row.orderId._id || row.orderId}/edit`}><Ltr>{row.orderId.orderId || row.orderId}</Ltr></Open></Sub>}
                      {row.matchedOriginalAmount > 0 && <Sub>المشتريات المختارة: <Ltr>{row.matchedOriginalAmount} {row.matchedOriginalCurrency}</Ltr>{row.matchDifferenceConfirmed && ' · اختلاف مؤكد بعد المراجعة'}</Sub>}
                      {row.originalAmount > 0 && <Sub>الأصل: <Ltr>{row.originalAmount} {row.originalCurrency}</Ltr></Sub>}
                      {row.crossRate > 0 && <Sub>السعر المباشر: <Ltr>{Number(row.crossRate).toFixed(6)} {row.rateQuoteCurrency}/{row.rateBaseCurrency}</Ltr></Sub>}
                      {row.settlementUsd > 0 && <Sub>مقابل الدولار في الكشف: <Ltr>{row.settlementUsd} USD</Ltr></Sub>}
                      {row.lineStatus === 'unmatched' && hint?.duplicates?.length > 0 && (
                        <Sub>
                          <Badge tone="warn">قد يكون مسجلاً</Badge>{' '}
                          {hint.duplicates.slice(0, 2).map((d: any) => <Ltr key={d._id}>{d.number} · </Ltr>)}
                        </Sub>
                      )}
                      {row.lineStatus === 'unmatched' && hint?.account && (
                        <Sub>يذهب إلى <b>{hint.account.code} · {hint.account.name}</b> <Badge tone={hint.source === 'history' ? 'info' : 'accent'}>{sourceText(hint)}</Badge>{hint.link && <> <Open to={`/invoice/${hint.link.orderId}/edit`}>طلبية <Ltr>{hint.link.orderNumber}</Ltr></Open></>}</Sub>
                      )}
                      {row.lineStatus === 'unmatched' && hint?.billCandidates?.length > 0 && <>
                        <Sub>مقترح: {billLabel(hint.billCandidates.find((b: any) => b._id === hint.suggestedBillId) || hint.billCandidates[0])}</Sub>
                        {hint.billCandidates.length > 1 && <Sub>يوجد {hint.billCandidates.length} فواتير محتملة؛ اختر الصحيحة قبل القبول.</Sub>}
                      </>}
                    </>
                  );
                },
              },
              { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Money value={row.amount} currency={currency} decimals={decimals} tone={row.amount < 0 ? 'credit' : 'debit'} strong />, sortValue: (row: any) => row.amount },
              { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.lineStatus} /> },
              { key: 'postedAccounts', header: 'الحسابات المسجل فيها', render: (row: any) => {
                const entries = [row.entryId, ...(row.matchedEntryIds || [])].filter(Boolean);
                const actual = new Map<string, any>();
                entries.forEach((entry: any) => (entry.lines || []).forEach((line: any) => { if (line.accountId?._id) actual.set(line.accountId._id, line.accountId); }));
                return actual.size ? <>{Array.from(actual.values()).map((a: any) => <Sub key={a._id}><Ltr>{a.code}</Ltr> · {a.name}</Sub>)}</> : <Sub>لا يوجد ترحيل مرتبط</Sub>;
              } },
              {
                key: 'actions', header: '', align: 'end', render: (row: any) => (
                  <span className="d-inline-flex gap-1 flex-wrap justify-content-end">
                    <Button size="small" onClick={() => setDetailsId(row._id)}>التفاصيل والتعديل</Button>
                    {row.lineStatus === 'unmatched' && <>
                      <Button size="small" variant="outlined" onClick={() => openEntry(row)}>مراجعة واعتماد</Button>
                      <Button size="small" onClick={() => run(() => acc.post(`bank/lines/${row._id}/ignore`), () => 'تم تجاهل السطر.')}>تجاهل</Button>
                    </>}
                    {['matched', 'ignored'].includes(row.lineStatus) && <Button size="small" onClick={() => run(() => acc.post(`bank/lines/${row._id}/unignore`), () => 'أُعيد السطر لغير مطابق.')}>تراجع</Button>}
                    {['unmatched', 'ignored'].includes(row.lineStatus) && (
                      <Tooltip title="حذف السطر من الكشف (استُورد خطأً)">
                        <IconButton size="small" color="error" onClick={() => {
                          if (window.confirm(`حذف السطر «${row.description}»؟`)) run(() => acc.delete(`bank/lines/${row._id}`), () => 'حُذف السطر.');
                        }}><Trash2 size={15} /></IconButton>
                      </Tooltip>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      )}

      {data?.unmatchedMovements.length > 0 && (
        <Panel flush title="في الدفاتر وليس في أي سطر من الكشف" subtitle="قيود على هذا الحساب لم يظهر لها سطر في الكشوف المرفوعة: إما لم يمر بعد في البنك، أو سُجّل خطأً.">
          <DataTable
            dense
            rows={data.unmatchedMovements}
            rowKey={(row: any) => row._id}
            columns={[
              { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
              { key: 'entry', header: 'القيد', render: (row: any) => <><Ltr>{row.number}</Ltr><Sub>{row.description}</Sub></> },
              { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => money(row.amount) },
            ]}
          />
        </Panel>
      )}

      {accountId && (
        <Panel
          flush
          title="قواعد الترحيل"
          subtitle="كل سطر يحتوي الكلمة يُقترح لحسابها، ويُرحَّل مع الترحيل الجماعي. تُضاف القاعدة من نافذة الترحيل أو من هنا."
          actions={<Button size="small" onClick={() => setNewRule({ keyword: '', direction: 'any', counterAccountId: '', allBanks: false })}>قاعدة جديدة</Button>}
        >
          <DataTable
            dense
            rows={rules}
            rowKey={(row: any) => row._id}
            empty={{ title: 'لا قواعد بعد', hint: 'عند ترحيل سطر اختر «تذكّر» ليصبح قاعدة.' }}
            columns={[
              { key: 'keyword', header: 'إذا احتوى البيان', render: (row: any) => <b>{row.keyword}</b> },
              { key: 'direction', header: 'الاتجاه', render: (row: any) => (row.direction === 'in' ? 'وارد' : row.direction === 'out' ? 'صادر' : 'الاثنان') },
              { key: 'account', header: 'يُرحَّل إلى', render: (row: any) => <>{row.counterAccountId?.code} · {row.counterAccountId?.name}{!row.accountId && <Sub>لكل البنوك</Sub>}{row.vendorName && <Sub>المورد: {row.vendorName === '@bank' ? 'البنك نفسه' : row.vendorName.replace(/\{party(:\d+)?\}/, '<رقم العميل في السطر>')}</Sub>}</> },
              {
                key: 'delete', header: '', align: 'end', render: (row: any) => (
                  <Tooltip title="حذف القاعدة"><IconButton size="small" onClick={() => run(() => acc.delete(`bank/rules/${row._id}`), () => 'حُذفت القاعدة.')}><Trash2 size={15} /></IconButton></Tooltip>
                ),
              },
            ]}
          />
        </Panel>
      )}

      {/* ---- Checking a file before it is imported ---- */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="xl" fullWidth>
        <DialogTitle>مراجعة الكشف قبل الاستيراد<Sub>{preview?.fileName} · {account ? accountLabel(account) : ''}</Sub></DialogTitle>
        {preview && (
          <DialogContent dividers>
            {preview.creditCard && <Alert severity="warning" className="mb-3">هذا كشف بطاقة ائتمان: المشتريات فيه موجبة والسداد سالب، فعُكست الإشارات لتصبح المشتريات صادرة (سالبة) وسداد البطاقة وارداً (موجباً). اختر في الحساب أعلاه حساب البطاقة نفسها.</Alert>}
            <FormControlLabel className="mb-2" control={<Checkbox size="small" checked={preview.flipAll} onChange={(e) => setPreview({ ...preview, flipAll: e.target.checked })} />} label="عكس إشارة كل السطور (كشوف بطاقات الائتمان)" />
            {preview.kind === 'pdf' && <Alert severity="info" className="mb-3">قُرئ الكشف من ملف PDF. راجع الإشارات: الوارد موجب والصادر سالب. غيّر إشارة أي سطر بزر السهم، واستبعد ما ليس حركة.</Alert>}
            {preview.kind === 'sheet' && (
              <div className="acc-bank-map">
                <TextField select size="small" label="صف العناوين" value={preview.headerRow} onChange={(e) => remap({ headerRow: Number(e.target.value), mapping: detect(preview.cells!.slice(Number(e.target.value))).mapping })}>
                  {preview.cells!.slice(0, 30).map((row, index) => <MenuItem key={index} value={index}>{index + 1}: {row.filter(Boolean).slice(0, 4).join(' | ')}</MenuItem>)}
                </TextField>
                {ROLES.map((role) => (
                  <TextField key={role.key} select size="small" label={role.label} value={preview.mapping[role.key] ?? ''}
                    onChange={(e) => remap({ mapping: { ...preview.mapping, [role.key]: e.target.value === '' ? undefined : Number(e.target.value) } })}>
                    <MenuItem value="">—</MenuItem>
                    {(preview.cells![preview.headerRow] || []).map((name: any, index: number) => <MenuItem key={index} value={index}>{String(name || `عمود ${index + 1}`)}</MenuItem>)}
                  </TextField>
                ))}
              </div>
            )}
            <StatGrid>
              <Stat label="سطور" value={previewRows.length} hint={previewRows.length ? <Ltr>{previewDays[0]} → {previewDays[previewDays.length - 1]}</Ltr> : 'لا شيء بعد: راجع الأعمدة'} />
              <Stat label="وارد / صادر" value={<Money value={Math.round(totalIn * 10 ** decimals)} currency={currency} decimals={decimals} />} hint={<>صادر <Money value={Math.round(totalOut * 10 ** decimals)} currency={currency} decimals={decimals} tone="plain" /></>} />
              <Stat label="يُرحَّل الآن" value={classes ? included.filter((r) => willPost(r.index)).length : '…'} tone="accent" hint="جديد وله حساب" />
              <Stat label="بلا حساب" value={classes ? included.filter((r) => ['new', 'maybeDuplicate'].includes(classes[r.index]?.status) && !willPost(r.index)).length : '…'} tone="warn" hint="يُستورد ويبقى لتصنيفه لاحقاً" />
              <Stat label="محذوف / مُتجاهَل" value={`${preview.skip.size} / ${included.filter((r) => preview.choices[r.index]?.ignore).length}`} hint="لا يُستورد / يُستورد بلا ترحيل" />
              <Stat label="مسجل / مستورد" value={classes ? `${included.filter((r) => classes[r.index]?.status === 'match').length} / ${included.filter((r) => classes[r.index]?.status === 'imported').length}` : '…'} hint="يُطابق تلقائياً / يُتجاهل" />
            </StatGrid>
            {preview.creditCard && preview.flipAll && <Alert severity="info" className="mb-3">
              الوارد يجمع سداد البطاقة والاستردادات. الصادر هو المصروفات قبل خصم الاسترداد.
              <div>سداد البطاقة: <Money value={Math.round(cardPayments * 10 ** decimals)} currency={currency} decimals={decimals} tone="plain" /> · الاستردادات: <Money value={Math.round(cardRefunds * 10 ** decimals)} currency={currency} decimals={decimals} tone="plain" /> · صافي المصروفات بعد الاسترداد: <Money value={Math.round((totalOut - cardRefunds) * 10 ** decimals)} currency={currency} decimals={decimals} tone="plain" /></div>
            </Alert>}
            <DataTable
              dense
              maxHeight={420}
              rows={preview.rows.map((row, index) => ({ ...row, index }))}
              rowKey={(row: any) => String(row.index)}
              rowTone={(row: any) => (preview.skip.has(row.index) ? 'canceled' : preview.choices[row.index]?.ignore ? 'muted' : undefined)}
              empty={{ title: 'لم تُقرأ أي حركة', hint: 'اختر صف العناوين والأعمدة الصحيحة أعلاه.' }}
              columns={[
                { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
                { key: 'description', header: 'البيان', render: (row: any) => <>{row.description}{row.reference && <Sub><Ltr>{row.reference}</Ltr></Sub>}{row.counterAmount > 0 && <Sub>المقابل: <Ltr>{Number(row.counterAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {row.counterCurrency}</Ltr></Sub>}</> },
                {
                  key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => {
                    const amount = (preview.flip.has(row.index) ? -1 : 1) * (preview.flipAll ? -1 : 1) * row.amount;
                    return (
                      <span className="d-inline-flex align-items-center gap-1">
                        <Tooltip title="عكس الإشارة"><IconButton size="small" onClick={() => toggleIn('flip', row.index)}><ArrowLeftRight size={13} /></IconButton></Tooltip>
                        <Money value={Math.round(amount * 10 ** decimals)} currency={currency} decimals={decimals} tone={amount < 0 ? 'credit' : 'debit'} strong />
                      </span>
                    );
                  },
                },
                {
                  key: 'status', header: 'الحالة', width: 150, render: (row: any) => {
                    const item = classes?.[row.index];
                    if (preview.skip.has(row.index)) return <Badge tone="danger">محذوف، لن يُستورد</Badge>;
                    if (preview.choices[row.index]?.ignore) return <Badge tone="muted">مُتجاهَل</Badge>;
                    if (!item) return <span className="acc-sub">…</span>;
                    const label = STATUS_LABEL[item.status];
                    return (
                      <>
                        <Badge tone={label.tone}>{label.text}</Badge>
                        {item.entry && <Sub><Ltr>{item.entry.number}</Ltr> · <Ltr>{item.entry.day}</Ltr></Sub>}
                        {item.status === 'maybeDuplicate' && (
                          <FormControlLabel className="acc-sub" control={<Checkbox size="small" checked={!!preview.choices[row.index]?.notDuplicate} onChange={(e) => markNotDuplicate(row.index, e.target.checked)} />} label="مختلف، رحّله" />
                        )}
                      </>
                    );
                  },
                },
                {
                  key: 'account', header: 'التصنيف (الحساب)', width: 280, render: (row: any) => {
                    const item = classes?.[row.index];
                    if (preview.skip.has(row.index) || preview.choices[row.index]?.ignore) return <span className="acc-sub">{preview.skip.has(row.index) ? '—' : 'يُستورد ولا يُرحَّل'}</span>;
                    if (!item || !['new', 'maybeDuplicate'].includes(item.status)) return <span className="acc-sub">{item?.status === 'match' ? 'يُطابق مع القيد' : item?.status === 'imported' ? 'لا شيء' : ''}</span>;
                    const choice = preview.choices[row.index] || {};
                    const selectedBillId = choice.billId || item.suggestedBillId || '';
                    const selectedBill = item.billCandidates?.find((bill: any) => bill._id === selectedBillId);
                    return (
                      <>
                        {item.isRefund && <Sub><Badge tone="info">Refund — استرداد</Badge>{item.vendorName && <Sub>المورد: {item.vendorName}</Sub>}<Sub>يُحفظ غير مرحّل حتى اعتماد الفاتورة أو الريفاند الأصلي.</Sub></Sub>}
                        {(row.amount < 0 || item.isRefund) && <Button size="small" onClick={() => setPurchaseReview({ line: row, paid: Math.abs(row.amount), index: row.index, refund: !!item.isRefund })}>{choice.purchaseSelection ? 'تغيير المطابقة' : item.isRefund ? 'ربط استرداد المشتريات' : 'مراجعة واعتماد'}</Button>}
                        {choice.purchaseSelection && <Alert severity="success" className="my-2">
                          مطابقة مختارة: <Ltr>{choice.purchaseSelection.number}</Ltr> · <Ltr>{choice.purchaseSelection.amount} {choice.purchaseSelection.currency}</Ltr>
                          {choice.purchaseSelection.orders.map((order: any, i: number) => <div key={`${order._id}-${i}`}>الطلبية: <Ltr>{order.number}</Ltr></div>)}
                          <Button size="small" onClick={() => setPreview(current => current ? { ...current, choices: { ...current.choices, [row.index]: { ...current.choices[row.index], purchaseMatch: undefined, purchaseSelection: undefined } } } : current)}>إلغاء الاختيار</Button>
                        </Alert>}
                        {!choice.purchaseSelection && (!item.billCandidates?.length || choice.confirmNewBill) && <Autocomplete
                          size="small" options={detailAccounts} value={detailAccounts.find((a) => a._id === choice.accountId) || null}
                          getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                          onChange={(_, a: any) => choose(row.index, a?._id || '')}
                          renderInput={(params) => <TextField {...params} placeholder="اختر الحساب" />}
                        />}
                        {!choice.accountId && row.amount * (preview.flip.has(row.index) ? -1 : 1) * (preview.flipAll ? -1 : 1) > 0 && (
                          <Sub>وارد بلا حساب: يُستورد ويُطابق تلقائياً مع إيداع محفظة العميل عند إدخاله على هذا البنك</Sub>
                        )}
                        {choice.link ? (
                          <Sub><Badge tone="ok">مربوط بطلبية</Badge> <Open to={`/invoice/${choice.link.orderId}/edit`}><Ltr>{choice.link.orderNumber}</Ltr></Open> · {choice.link.itemDescription}</Sub>
                        ) : !choice.byHand && item.source && item.source !== 'order' && <Sub>{sourceText(item)}</Sub>}
                        {!!item.billCandidates?.length && !choice.purchaseMatch && <>
                          {selectedBill && <Sub>مقترح: {billLabel(selectedBill)}</Sub>}
                          <FormControlLabel control={<Checkbox size="small" checked={!!choice.confirmNewBill}
                            onChange={e => setPreview(current => current ? { ...current, choices: { ...current.choices, [row.index]: { ...current.choices[row.index], confirmNewBill: e.target.checked, billAccepted: false, byHand: true } } } : current)} />}
                            label="هذه عملية جديدة ولا تخص الفواتير المقترحة" />
                          {!choice.billAccepted && !choice.confirmNewBill && <Sub>سيُحفظ السطر دون سداد حتى توافق على المطابقة.</Sub>}
                        </>}
                        {choice.vendorName && <Sub>{choice.billId ? 'سداد الفاتورة الأصلية للمورد' : `فاتورة بـ${row.originalCurrency || currency} للمورد`} <b>{choice.vendorName === '@bank' ? account?.name : choice.vendorName}</b> ودفعها من البنك</Sub>}
                        {row.originalAmount && row.originalCurrency && <Sub>
                          الأصل: <Ltr>{row.originalAmount} {row.originalCurrency}</Ltr> · السداد: <Ltr>{Math.abs(row.amount)} {currency}</Ltr>
                          <br />السعر المباشر: <Ltr>{(Math.abs(row.amount) / row.originalAmount).toFixed(6)} {currency}/{row.originalCurrency}</Ltr>
                          {row.settlementUsd && <><br />مقابل البنك: <Ltr>{row.settlementUsd} USD</Ltr> · السعر: <Ltr>{(Math.abs(row.amount) / row.settlementUsd).toFixed(6)} {currency}/USD</Ltr></>}
                        </Sub>}
                      </>
                    );
                  },
                },
                {
                  key: 'rowActions', header: '', width: 84, align: 'end', render: (row: any) => {
                    const skipped = preview.skip.has(row.index);
                    const ignored = !!preview.choices[row.index]?.ignore;
                    if (skipped || ignored) {
                      return <Tooltip title="تراجع"><IconButton size="small" onClick={() => (skipped ? toggleIn('skip', row.index) : toggleIgnore(row.index))}><RotateCcw size={15} /></IconButton></Tooltip>;
                    }
                    return (
                      <span className="d-inline-flex">
                        <Tooltip title="تجاهل: يُحفظ في الكشف ولا يُرحَّل، ولا يعود مع ملف لاحق"><IconButton size="small" onClick={() => toggleIgnore(row.index)}><EyeOff size={15} /></IconButton></Tooltip>
                        <Tooltip title="حذف: لا يُستورد هذا السطر"><IconButton size="small" color="error" onClick={() => toggleIn('skip', row.index)}><Trash2 size={15} /></IconButton></Tooltip>
                      </span>
                    );
                  },
                },
              ]}
            />
          </DialogContent>
        )}
        <DialogActions>
          <span className="acc-sub me-auto ps-2">المستورد من قبل يُتجاهل، والمسجل في الدفاتر يُطابق، والجديد الذي له حساب يُرحَّل. الباقي يبقى في «غير مطابق».</span>
          <Button onClick={() => setPreview(null)}>إلغاء</Button>
          <Button variant="contained" onClick={importPreview} disabled={!previewRows.length}>استيراد {previewRows.length} سطراً</Button>
        </DialogActions>
      </Dialog>

      {/* ---- Posting one line ---- */}
      <Dialog open={!!entryFor} onClose={() => { if (!reviewSaving) setEntryFor(null); }} maxWidth="lg" fullWidth>
        <DialogTitle>مراجعة سطر الكشف واعتماده</DialogTitle>
        {entryFor && (
          <DialogContent>
            <TextField select disabled={reviewSaving} size="small" fullWidth className="mb-3" label="طريقة الاعتماد" value={entryFor.mode} onChange={e => setEntryFor({ ...entryFor, mode: e.target.value })}>
              {entryFor.line.amount < 0 && <MenuItem value="purchase">سداد مشتريات / تكلفة طلب على الفاتورة الأصلية</MenuItem>}
              {entryFor.line.amount > 0 && <MenuItem value="refund">استرداد مشتريات / ربط ريفاند الطلبية</MenuItem>}
              {entryFor.line.amount > 0 && entryFor.line.movementKind !== 'card_payment' && <MenuItem value="pending_refund">ترحيل استرداد قيد التحديد — الطلبية غير معروفة</MenuItem>}
              <MenuItem value="ledger">مطابقة مع قيد مسجل سابقًا</MenuItem>
              <MenuItem value="new">ترحيل عملية جديدة</MenuItem>
            </TextField>
            {entryFor.mode === 'pending_refund' && <>
              <Alert severity="info">سيُسجل استلام البنك مقابل حساب 219100 «استردادات موردين قيد التحديد». عند تحديد الطلبية، اختر هذا المبلغ من نموذج الريفاند لتسوية المعلّق وإضافة مبلغ العميل دون استلام البنك مرة ثانية.</Alert>
              {entryFor.error && <Alert severity="error" className="mt-2">{entryFor.error}</Alert>}
              <Button className="mt-3" variant="contained" disabled={reviewSaving} onClick={async () => {
                setReviewSaving(true);
                try {
                  await acc.post(`bank/lines/${entryFor.line._id}/entry`, { pendingRefund: true });
                  setEntryFor(null); await load();
                } catch (err) { setEntryFor({ ...entryFor, error: errorText(err) }); }
                finally { setReviewSaving(false); }
              }}>ترحيل إلى الاستردادات قيد التحديد</Button>
            </>}
            {entryFor.mode === 'refund' && <PurchaseMatchPicker embedded open refund accountId={accountId} line={entryFor.line}
              paid={Math.abs(entryFor.line.amount) / 10 ** decimals} currency={currency} bankName={account?.name} onBusyChange={setReviewSaving}
              onClose={() => setEntryFor(null)} onConfirm={async (selected: any, options: any) => {
                await acc.post(`bank/lines/${entryFor.line._id}/refund-match`, { ...options, kind: selected.kind, billId: selected.billId, refundId: selected.refundId });
                setEntryFor(null); setMessage({ type: 'success', text: 'اعتُمد الاسترداد وربط بالعملية الأصلية دون تكرار.' }); await load();
              }} />}
            {entryFor.mode === 'purchase' && <PurchaseMatchPicker embedded open accountId={accountId} line={entryFor.line}
              paid={Math.abs(entryFor.line.amount) / 10 ** decimals} currency={currency}
              bankName={account?.name}
              suggestedBillId={entryFor.billId || suggested[entryFor.line._id]?.billCandidates?.[0]?._id}
              suggestedItemId={suggested[entryFor.line._id]?.link?.itemId} onBusyChange={setReviewSaving}
              onClose={() => setEntryFor(null)} onConfirm={async (selected: any, options: any) => {
                await acc.post(`bank/lines/${entryFor.line._id}/purchase-match`, { kind: selected.kind, billId: selected.billId,
                  orderId: selected.orderId, itemId: selected.itemId, confirmDifference: !!options.confirmDifference });
                setEntryFor(null); setMessage({ type: 'success', text: 'اعتُمدت المطابقة وسُجّل السداد دون تكرار التكلفة.' }); await load();
              }} />}
            {entryFor.mode === 'ledger' && <BankReviewComparison line={entryFor.line} currency={currency} bankName={account?.name} paid={Math.abs(entryFor.line.amount) / 10 ** decimals}
              leftTitle="القيد المقترح من الدفاتر"
              reasons={['نفس حساب البنك وعملته', ...((data?.unmatchedMovements || []).filter((m: any) => entryFor.selected.includes(m._id)).reduce((sum: number, m: any) => sum + m.amount, 0) === entryFor.line.amount ? ['مبلغ القيد يساوي مبلغ الكشف'] : []),
                ...((data?.unmatchedMovements || []).filter((m: any) => entryFor.selected.includes(m._id)).every((m: any) => m.day === entryFor.line.day) && entryFor.selected.length ? ['التاريخ مطابق'] : [])]}
              warnings={suggested[entryFor.line._id]?.duplicates?.length > 1 ? ['يوجد أكثر من قيد محتمل بنفس المبلغ؛ راجع رقم القيد والبيان قبل الموافقة.'] : []}>
              {(data?.unmatchedMovements || []).filter((m: any) => entryFor.selected.includes(m._id)).map((m: any) => <div key={m._id} className="mb-3">
                <ReviewField label="رقم القيد"><Open to={`/accounting/entries/${m._id}`}><Ltr>{m.number}</Ltr></Open></ReviewField>
                <ReviewField label="التاريخ"><Ltr>{m.day}</Ltr></ReviewField>
                <ReviewField label="حركة البنك">{money(m.amount)}</ReviewField>
                <div className="acc-sub" dir="auto">{m.description}</div>
              </div>)}
              <Button disabled={reviewSaving} onClick={() => setEntryFor({ ...entryFor, changeLedger: !entryFor.changeLedger })}>{entryFor.changeLedger ? 'إخفاء قائمة القيود' : 'تغيير القيد'}</Button>
              {entryFor.changeLedger && (data?.unmatchedMovements || []).map((m: any) => <label key={m._id} className="d-flex align-items-center gap-2">
                <Checkbox checked={entryFor.selected.includes(m._id)} onChange={e => setEntryFor({ ...entryFor, selected: e.target.checked ? [...entryFor.selected, m._id] : entryFor.selected.filter((id: string) => id !== m._id) })} />
                <span><Ltr>{m.day} · {m.number}</Ltr> · {money(m.amount)} · {m.description}</span>
              </label>)}
              {!entryFor.selected.length && <Alert severity="info" className="mt-2">اختر القيد الموجود؛ لا يُنشأ قيد جديد عند المطابقة.</Alert>}
              <div className="acc-sub mt-3">ستُربط حركة الكشف بهذا القيد؛ أرصدة الحسابات لا تتغير.</div>
            </BankReviewComparison>}
            {entryFor.mode === 'new' && <BankReviewComparison line={entryFor.line} currency={currency} bankName={account?.name} paid={Math.abs(entryFor.line.amount) / 10 ** decimals}
              leftTitle="تفاصيل العملية التي ستُرحّل" reasons={suggested[entryFor.line._id]?.account && entryFor.counterAccountId === suggested[entryFor.line._id].account._id ? [sourceText(suggested[entryFor.line._id])] : []}>
            {entryFor.line.amount > 0 && (suggested[entryFor.line._id]?.isRefund || entryFor.line.movementKind === 'purchase_refund') && <Alert severity="warning" className="mb-2">الكشف يشير إلى استرداد مشتريات. اختر مسار الاسترداد لربطه بالطلبية.<FormControlLabel control={<Checkbox checked={!!entryFor.confirmNotRefund} onChange={e => setEntryFor({ ...entryFor, confirmNotRefund: e.target.checked })} />} label="راجعت المستند وأؤكد أن هذه العملية ليست استرداد مشتريات" /></Alert>}
            {suggested[entryFor.line._id]?.duplicates?.length > 0 && (
              <Alert severity="warning" className="mb-3">
                في الدفاتر قيد بنفس المبلغ قريب من هذا التاريخ ({suggested[entryFor.line._id].duplicates.map((d: any) => d.number).join('، ')}). إن كان هو نفسه فطابقه بدل الترحيل.
                <FormControlLabel className="d-block mt-1" control={<Checkbox size="small" checked={entryFor.confirmNotDuplicate} onChange={(e) => setEntryFor({ ...entryFor, confirmNotDuplicate: e.target.checked })} />} label="هذا سطر مختلف، رحّله" />
              </Alert>
            )}
            {entryFor.line.amount < 0 && (
              <TextField select size="small" fullWidth className="mb-3" label="يُوجَّه إلى" value={entryFor.target || ''} onChange={(e) => setEntryFor({ ...entryFor, target: e.target.value, billAccepted: false,
                mode: e.target.value === 'order' && !entryFor.confirmNewBill && (suggested[entryFor.line._id]?.billCandidates?.length || suggested[entryFor.line._id]?.link) ? 'purchase' : 'new' })}
                helperText={entryFor.target === 'trip' ? 'فاتورة مورد على الرحلة مدفوعة من هذا الحساب (شحن دفعه أسواق مثلاً).'
                  : entryFor.target === 'order' ? 'فاتورة مورد على الطلب مدفوعة من هذا الحساب (مشتريات أو ضرائب دفعها الشريك).'
                  : entryFor.target === 'debt' ? 'دين على العميل في المنظومة، مصدره هذا الحساب.' : undefined}>
                <MenuItem value="">حساب (مصروف، مورد، بنك...)</MenuItem>
                <MenuItem value="trip">تكلفة رحلة</MenuItem>
                <MenuItem value="order">تكلفة طلب</MenuItem>
                <MenuItem value="debt">دين على عميل</MenuItem>
              </TextField>
            )}
            {entryFor.target === 'trip' && <RemotePicker endpoint="trips" minLength={0} label="الرحلة" value={entryFor.trip} getLabel={tripLabel} onChange={(trip) => setEntryFor({ ...entryFor, trip })} />}
            {entryFor.target === 'order' && <RemotePicker endpoint="lookup/orders" label="رقم الطلب" value={entryFor.order} getLabel={orderLabel} onChange={(order) => setEntryFor({ ...entryFor, order })} />}
            {entryFor.target === 'debt' && <RemotePicker endpoint="lookup/users" label="العميل" value={entryFor.partner} getLabel={userLabel} onChange={(partner) => setEntryFor({ ...entryFor, partner })} />}
            {!entryFor.target && (
            <Autocomplete size="small" options={detailAccounts} value={detailAccounts.find((a) => a._id === entryFor.counterAccountId) || null}
              getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, a: any) => setEntryFor({ ...entryFor, counterAccountId: a?._id || '', link: a?._id === suggested[entryFor.line._id]?.account?._id ? suggested[entryFor.line._id]?.link : undefined })}
              renderInput={(p) => <TextField {...p} label="الحساب المقابل (رسوم، إيجار، مورد، أو حساب بنك)" />} />
            )}
            {entryFor.link && <Alert severity="success" className="mt-2">مربوط بمشتريات الطلبية <Open to={`/invoice/${entryFor.link.orderId}/edit`}><Ltr>{entryFor.link.orderNumber}</Ltr></Open>: {entryFor.link.itemDescription} ({entryFor.link.amount} {entryFor.link.currency}). تُسجَّل تكلفةً على الطلبية.{entryFor.link.near && ' المطابقة تقريبية بالدولار (فرق حتى 2%)؛ تأكد أنها نفس الشراء.'}</Alert>}
            {!!suggested[entryFor.line._id]?.billCandidates?.length && <>
              <Alert severity="info" className="mt-3">
                توجد فاتورة مقترحة. إذا كانت نفس المشتريات، اعتمد سداد الفاتورة الأصلية لتجنب تكرار التكلفة.
                <Button className="d-block" onClick={() => {
                  setEntryFor({ ...entryFor, mode: 'purchase' });
                }}>مراجعة واختيار المشتريات</Button>
              </Alert>
              <FormControlLabel control={<Checkbox size="small" checked={!!entryFor.confirmNewBill}
                onChange={e => setEntryFor({ ...entryFor, confirmNewBill: e.target.checked, billAccepted: false })} />} label="هذه عملية جديدة ولا تخص الفواتير المقترحة" />
            </>}
            <div className="acc-form-grid mt-3">
              <TextField select size="small" label="المكتب" value={entryFor.office} onChange={(e) => setEntryFor({ ...entryFor, office: e.target.value })}>
                <MenuItem value="">حسب البنك</MenuItem>
                {offices.filter((o: any) => o.isActive).map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
              </TextField>
              <TextField size="small" label="البيان" value={entryFor.description} onChange={(e) => setEntryFor({ ...entryFor, description: e.target.value })} />
            </div>
            {entryFor.line.amount < 0 && (entryFor.link || ['trip', 'order'].includes(entryFor.target) || (!entryFor.target && detailAccounts.find((a) => a._id === entryFor.counterAccountId)?.type === 'expense')) && (
              <TextField size="small" fullWidth className="mt-3" label="المورد" value={entryFor.vendorName === '@bank' ? account?.name || '' : entryFor.vendorName}
                onChange={(e) => setEntryFor({ ...entryFor, vendorName: e.target.value })}
                helperText="تُحفظ الفاتورة بعملة الشراء الأصلية والسداد بعملة البنك. السعر المباشر = المبلغ المدفوع ÷ المبلغ الأصلي. يُحفظ مقابل الدولار فقط عندما يذكره الكشف. فارغ = اسم التاجر في السطر." />
            )}
            {!entryFor.target && <FormControlLabel className="mt-2" control={<Checkbox size="small" checked={entryFor.remember} onChange={(e) => setEntryFor({ ...entryFor, remember: e.target.checked })} />} label="تذكّر: كل سطر يحتوي الكلمة التالية يُرحَّل لهذا الحساب" />}
            {entryFor.remember && <TextField size="small" fullWidth label="الكلمة المفتاحية" value={entryFor.keyword} onChange={(e) => setEntryFor({ ...entryFor, keyword: e.target.value })} helperText="مثلاً: commission أو عمولة. تُطبق على الكشوف القادمة." />}
            </BankReviewComparison>}
          </DialogContent>
        )}
        {entryFor?.mode === 'new' && <DialogActions>
          <Button disabled={reviewSaving} onClick={() => setEntryFor(null)}>إلغاء</Button>
          <Button variant="contained" onClick={saveEntry}
            disabled={reviewSaving || (suggested[entryFor?.line?._id]?.billCandidates?.length > 0 && !entryFor?.confirmNewBill && !(entryFor?.billAccepted && entryFor?.billId && !entryFor?.target)) || (entryFor?.target ? !(entryFor.target === 'trip' ? entryFor.trip : entryFor.target === 'order' ? entryFor.order : entryFor.partner) : !(entryFor?.counterAccountId || (entryFor?.billAccepted && entryFor?.billId))) || (suggested[entryFor?.line?._id]?.duplicates?.length > 0 && !entryFor?.confirmNotDuplicate) || (entryFor?.remember && !String(entryFor?.keyword || '').trim())}>
            {entryFor?.billAccepted ? 'قبول المطابقة وتسجيل السداد' : 'ترحيل'}
          </Button>
        </DialogActions>}
        {entryFor?.mode === 'ledger' && <DialogActions>
          <Button disabled={reviewSaving} onClick={() => setEntryFor(null)}>إلغاء</Button>
          <Button variant="contained" disabled={reviewSaving || !entryFor.selected.length || (data?.unmatchedMovements || []).filter((m: any) => entryFor.selected.includes(m._id)).reduce((sum: number, m: any) => sum + m.amount, 0) !== entryFor.line.amount} onClick={async () => {
            if (reviewSaving) return;
            setReviewSaving(true);
            try {
              if (await run(() => acc.post(`bank/lines/${entryFor.line._id}/match`, { entryIds: entryFor.selected }), () => 'تمت المطابقة دون إنشاء قيد جديد.')) setEntryFor(null);
            } finally { setReviewSaving(false); }
          }}>موافقة على المطابقة</Button>
        </DialogActions>}
      </Dialog>

      {/* ---- Several lines for one purchase ---- */}
      <Dialog open={!!group} onClose={() => setGroup(null)} maxWidth="sm" fullWidth>
        <DialogTitle>ربط سطور الكشف بمشتريات طلب</DialogTitle>
        {group && (
          <DialogContent>
            <p className="acc-muted">
              {group.lines.length} سطر، مجموعها <Money value={group.lines.reduce((sum: number, l: any) => sum + l.amount, 0)} currency={currency} decimals={decimals} strong />.
              تُسجَّل فاتورة واحدة للمشتريات على الطلب ودفعة من كل سطر بعملة البنك.
            </p>
            <RemotePicker endpoint="lookup/orders" label="الطلب" value={group.order} getLabel={orderLabel} onChange={async (order) => {
              const items = order ? (await acc.get(`bank/order-items/${order._id}`)).data.items : [];
              setGroup({ ...group, order, items, itemId: items.find((i: any) => !i.linked)?._id || '' });
            }} />
            {group.order && (
              <TextField select fullWidth size="small" className="mt-3" label="المشتريات" value={group.itemId} onChange={(e) => setGroup({ ...group, itemId: e.target.value })}>
                {group.items.map((i: any) => <MenuItem key={i._id} value={i._id} disabled={i.linked}>{i.description} · {i.unitPrice} {i.currency}{i.linked ? ' (مرتبطة)' : ''}</MenuItem>)}
              </TextField>
            )}
            {group.order && !group.items.length && <Alert severity="info" className="mt-2">لا مشتريات مكتوبة على هذا الطلب. أضفها في صفحة الطلب أولاً.</Alert>}
            <FormControlLabel className="mt-2" control={<Checkbox size="small" checked={group.confirmDifference} onChange={(e) => setGroup({ ...group, confirmDifference: e.target.checked })} />} label="نفس العملية حتى لو اختلف المبلغ بأكثر من 2%" />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setGroup(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!group?.itemId} onClick={async () => {
            const ok = await run(() => acc.post('bank/link-group', { lineIds: group.lines.map((l: any) => l._id), orderId: group.order._id, itemId: group.itemId, confirmDifference: group.confirmDifference }), (d) => `رُبطت ${d.linked} سطور بمشتريات الطلب.`);
            if (ok) setGroup(null);
          }}>ربط</Button>
        </DialogActions>
      </Dialog>

      {/* ---- A new rule ---- */}
      <Dialog open={!!newRule} onClose={() => setNewRule(null)} maxWidth="xs" fullWidth>
        <DialogTitle>قاعدة ترحيل</DialogTitle>
        {newRule && (
          <DialogContent>
            <TextField size="small" fullWidth className="mt-2" label="إذا احتوى البيان" value={newRule.keyword} onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })} />
            <TextField select size="small" fullWidth className="mt-3" label="الاتجاه" value={newRule.direction} onChange={(e) => setNewRule({ ...newRule, direction: e.target.value })}>
              <MenuItem value="any">وارد وصادر</MenuItem>
              <MenuItem value="out">صادر فقط</MenuItem>
              <MenuItem value="in">وارد فقط</MenuItem>
            </TextField>
            <Autocomplete size="small" className="mt-3" options={detailAccounts} value={detailAccounts.find((a) => a._id === newRule.counterAccountId) || null}
              getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, a: any) => setNewRule({ ...newRule, counterAccountId: a?._id || '' })}
              renderInput={(p) => <TextField {...p} label="يُرحَّل إلى" />} />
            {detailAccounts.find((a) => a._id === newRule.counterAccountId)?.type === 'expense' && (
              <TextField size="small" fullWidth className="mt-3" label="المورد (اختياري)" value={newRule.vendorName || ''} onChange={(e) => setNewRule({ ...newRule, vendorName: e.target.value })}
                helperText="تُسجَّل فاتورة بالدولار لهذا المورد. فارغ = اسم التاجر في السطر." />
            )}
            <FormControlLabel className="mt-2" control={<Checkbox size="small" checked={newRule.allBanks} onChange={(e) => setNewRule({ ...newRule, allBanks: e.target.checked })} />} label="لكل البنوك والمحافظ" />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setNewRule(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!newRule?.keyword?.trim() || !newRule?.counterAccountId} onClick={async () => {
            if (await run(() => acc.post('bank/rules', { keyword: newRule.keyword, direction: newRule.direction, counterAccountId: newRule.counterAccountId, vendorName: newRule.vendorName || undefined, accountId: newRule.allBanks ? undefined : accountId }), () => 'أُضيفت القاعدة.')) setNewRule(null);
          }}>حفظ</Button>
        </DialogActions>
      </Dialog>

      <PurchaseMatchPicker open={!!purchaseReview} accountId={accountId} line={purchaseReview?.line} paid={purchaseReview?.paid} currency={currency}
        refund={!!purchaseReview?.refund}
        suggestedBillId={purchaseReview?.index !== undefined ? classes?.[purchaseReview.index]?.suggestedBillId : undefined}
        suggestedItemId={purchaseReview?.index !== undefined ? classes?.[purchaseReview.index]?.link?.itemId : undefined}
        onClose={() => setPurchaseReview(null)} onConfirm={async (selected: any, options: any) => {
          const selection = { ...options, kind: selected.kind, billId: selected.billId, refundId: selected.refundId, orderId: selected.orderId, itemId: selected.itemId, confirmDifference: !!options.confirmDifference };
          if (purchaseReview.index !== undefined) {
            const index = purchaseReview.index;
            setPreview(current => current ? { ...current, choices: { ...current.choices, [index]: { byHand: true, purchaseMatch: selection, purchaseSelection: selected, notDuplicate: current.choices[index]?.notDuplicate } } } : current);
          } else {
            await acc.post(`bank/lines/${purchaseReview.line._id}/purchase-match`, selection);
            setMessage({ type: 'success', text: 'تمت المطابقة مع المشتريات المختارة وحُفظ ارتباط الفاتورة والطلبية.' });
            await load();
          }
          setPurchaseReview(null);
        }} />

    </>
  );
};

export default BankReconciliation;
