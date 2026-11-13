import { useMemo, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { accountLabel } from './useAccountingData';
import { Badge, Ltr, Money } from './ui';

// Posting many statement lines at once after one review (owner's request 2026-11-13: posting the
// Alipay history line by line was too slow). Each line still goes through the same endpoint as the
// single-line button, so every server rule (duplicates, possible bills, before-count purchases)
// still applies; a line the server refuses is listed with its reason and stays unmatched.

// review: postable, but the server flagged something to look at first, so it starts unchosen
export type BulkPostKind = 'post' | 'review' | 'refund' | 'blocked';
export type BulkPostRow = { line: any; kind: BulkPostKind; reason?: string; accountId: string; include: boolean };

// What can be posted in bulk, and the account each line starts with (the suggestion)
const isPost = (row: BulkPostRow) => row.kind === 'post' || row.kind === 'review';

export const bulkPostPlan = (lines: any[], hints: Record<string, any>): BulkPostRow[] => lines.filter((line) => line.lineStatus === 'unmatched').map((line) => {
  const hint = hints[line._id] || {};
  const accountId = hint.account?._id || '';
  const blocked = (reason: string): BulkPostRow => ({ line, kind: 'blocked', reason, accountId, include: false });
  const refund = line.amount > 0 && (line.movementKind === 'purchase_refund' || !!hint.isRefund);
  if (line.walletImpact === 'unknown') return blocked('طريقة الاستلام غير مؤكدة؛ راجعه وحده');
  if (refund) return { line, kind: 'refund', reason: 'استرداد: يُرحّل إلى «استردادات قيد التحديد» ثم يُربط بطلبيته لاحقًا', accountId: '', include: false };
  if (line.sourceProvider === 'alipay' && line.amount > 0) return blocked('وارد Alipay: طابقه مع شراء اليوان أو التحويل من قسمه');
  if (hint.semanticTransfer) return blocked('تحويل أو تسوية تحتاج تأكيدًا؛ رحّله وحده');
  if (hint.duplicates?.length) return blocked('قد يكون مسجلًا في الدفاتر؛ راجعه وحده');
  if (hint.link?.itemId) return blocked('مقترح ربطه ببند طلبية؛ رحّله وحده لتأكيد البند');
  if (hint.billCandidates?.length || hint.tripCandidates?.length) return blocked('توجد فاتورة أو رحلة محتملة؛ رحّله وحده حتى لا تتكرر التكلفة');
  // Other flags (the vendor has unpaid bills, entries adding up to the amount...): the person decides
  if (hint.requiresConfirmation || hint.vendorBills || hint.combinations?.length) return { line, kind: 'review', reason: hint.reason || (hint.combinations?.length ? 'قيود في الدفاتر مجموعها يساوي المبلغ؛ تأكد أنها ليست نفس العملية' : 'راجعه قبل الترحيل'), accountId, include: false };
  return { line, kind: 'post', accountId, include: !!accountId };
});

// The request each included row sends
export const bulkPostInput = (row: BulkPostRow, hint: any, { office, confirmBeforeCount }: { office?: string; confirmBeforeCount: boolean }) => {
  if (row.kind === 'refund') return { pendingRefund: true };
  const same = !!hint?.account && hint.account._id === row.accountId;
  return {
    counterAccountId: row.accountId,
    office: (same && hint.office) || office || undefined,
    vendorName: (same && hint.vendorName) || undefined,
    ...(same && hint.billId && { billId: hint.billId }),
    ...(confirmBeforeCount && { confirmBeforeCountPurchase: true }),
  };
};

type Props = {
  lines: any[];
  hints: Record<string, any>;
  accounts: any[];
  currency: string;
  decimals: number;
  office?: string;
  // Money out before the count to the purchases cost account: the server asks for a confirmation
  isBeforeCountCost: (line: any, accountId: string) => boolean;
  onClose: () => void;
  onDone: () => any;
};

export default function BankBulkPost({ lines, hints, accounts, currency, decimals, office, isBeforeCountCost, onClose, onDone }: Props) {
  const [rows, setRows] = useState<BulkPostRow[]>(() => bulkPostPlan(lines, hints));
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [withRefunds, setWithRefunds] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [bulkAccount, setBulkAccount] = useState<any>(null);
  const [confirmBeforeCount, setConfirmBeforeCount] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ posted: number; total: number; failures: string[] } | null>(null);

  const byId = useMemo(() => new Map(accounts.map((a) => [a._id, a])), [accounts]);
  const postable = (row: BulkPostRow) => isPost(row) ? !!row.accountId : row.kind === 'refund' && withRefunds;
  const chosen = rows.filter((row) => row.include && postable(row));
  const needle = search.trim().toLowerCase();
  const visible = rows.filter((row) => (showBlocked || row.kind !== 'blocked')
    && (!direction || (direction === 'out' ? row.line.amount < 0 : row.line.amount > 0))
    && (!needle || `${row.line.description} ${row.line.counterparty || ''} ${row.line.reference || ''}`.toLowerCase().includes(needle)));
  const beforeCount = chosen.filter((row) => isPost(row) && isBeforeCountCost(row.line, row.accountId));
  const counts = { post: rows.filter((r) => isPost(r)).length, review: rows.filter((r) => r.kind === 'review').length, refund: rows.filter((r) => r.kind === 'refund').length, blocked: rows.filter((r) => r.kind === 'blocked').length };

  // The preview: how many lines and how much goes to each account
  const summary = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; total: number }>();
    for (const row of chosen) {
      const key = row.kind === 'refund' ? 'refund' : row.accountId;
      const label = row.kind === 'refund' ? 'استردادات قيد التحديد' : accountLabel(byId.get(row.accountId) || { code: '', name: '?' });
      const group = groups.get(key) || { label, count: 0, total: 0 };
      group.count++; group.total += row.line.amount;
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [chosen, byId]);

  const update = (id: string, change: Partial<BulkPostRow>) => setRows((current) => current.map((row) => (row.line._id === id ? { ...row, ...change } : row)));
  const visibleIds = new Set(visible.filter(postable).map((row) => row.line._id));
  const allVisible = visibleIds.size > 0 && visible.filter(postable).every((row) => row.include);
  const setVisible = (include: boolean) => setRows((current) => current.map((row) => (visibleIds.has(row.line._id) ? { ...row, include } : row)));
  const applyAccount = () => bulkAccount && setRows((current) => current.map((row) => (isPost(row) && row.include && visible.some((v) => v.line._id === row.line._id) ? { ...row, accountId: bulkAccount._id } : row)));

  const execute = async () => {
    const list = chosen;
    const failures: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress({ done: i, total: list.length });
      const row = list[i];
      try {
        await acc.post(`bank/lines/${row.line._id}/entry`, bulkPostInput(row, hints[row.line._id], { office, confirmBeforeCount: confirmBeforeCount && isBeforeCountCost(row.line, row.accountId) }));
      } catch (err) {
        failures.push(`${row.line.day} · ${String(row.line.description).slice(0, 60)}: ${errorText(err)}`);
      }
    }
    setProgress(null);
    setResult({ posted: list.length - failures.length, total: list.length, failures });
    await onDone();
  };

  const money = (value: number) => <Money value={value} currency={currency} decimals={decimals} tone={value < 0 ? 'credit' : 'debit'} />;

  return (
    <Dialog open onClose={progress ? undefined : onClose} maxWidth="lg" fullWidth dir="rtl">
      <DialogTitle>مراجعة وترحيل المحدد</DialogTitle>
      <DialogContent>
        {result ? (
          <Alert severity={result.failures.length ? 'warning' : 'success'}>
            رُحّل {result.posted} من {result.total}.
            {result.failures.length > 0 && <>
              <div className="mt-1">لم يُرحّل (بقي غير مطابق، عالجه وحده):</div>
              <ul className="mb-0 mt-1">{result.failures.map((failure) => <li key={failure}>{failure}</li>)}</ul>
            </>}
          </Alert>
        ) : <>
          <p className="acc-muted">
            محدد {rows.length} سطرًا: {counts.post} قابلة للترحيل (منها {counts.review} غير مختارة لأنها تحتاج نظرة) · {counts.refund} استرداد · {counts.blocked} تحتاج معالجة وحدها.
            راجع الحساب لكل سطر أو غيّره لمجموعة دفعة واحدة، ثم أكّد. يتحقق الخادم من كل سطر قبل ترحيله.
          </p>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <TextField size="small" label="بحث في البيان" value={search} onChange={(e) => setSearch(e.target.value)} />
            <TextField size="small" select label="الاتجاه" value={direction} onChange={(e) => setDirection(e.target.value)} style={{ minWidth: 120 }}>
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="out">صادر</MenuItem>
              <MenuItem value="in">وارد</MenuItem>
            </TextField>
            <FormControlLabel control={<Checkbox size="small" checked={withRefunds} onChange={(e) => setWithRefunds(e.target.checked)} />} label={`ترحيل الاستردادات أيضًا (${counts.refund})`} />
            <FormControlLabel control={<Checkbox size="small" checked={showBlocked} onChange={(e) => setShowBlocked(e.target.checked)} />} label={`إظهار ما لا يُرحّل جماعيًا (${counts.blocked})`} />
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <Autocomplete size="small" style={{ minWidth: 320 }} options={accounts} value={bulkAccount}
              getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, a: any) => setBulkAccount(a)} renderInput={(p) => <TextField {...p} label="حساب واحد للسطور المختارة الظاهرة" />} />
            <Button size="small" variant="outlined" disabled={!bulkAccount} onClick={applyAccount}>تطبيق</Button>
          </div>

          <div className="table-responsive" style={{ maxHeight: '45vh', overflow: 'auto' }}>
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th><Checkbox size="small" checked={allVisible} indeterminate={!allVisible && visible.some((r) => r.include && postable(r))} onChange={(e) => setVisible(e.target.checked)} /></th>
                  <th>التاريخ</th><th>البيان</th><th className="text-end">المبلغ</th><th style={{ minWidth: 280 }}>الحساب</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const hint = hints[row.line._id] || {};
                  return (
                    <tr key={row.line._id} style={row.kind === 'blocked' || (row.kind === 'refund' && !withRefunds) ? { opacity: 0.55 } : undefined}>
                      <td><Checkbox size="small" disabled={!postable(row)} checked={row.include && postable(row)} onChange={(e) => update(row.line._id, { include: e.target.checked })} /></td>
                      <td><Ltr>{row.line.day}</Ltr></td>
                      <td style={{ maxWidth: 380 }}>
                        <div className="text-truncate" title={row.line.description}>{row.line.description}</div>
                        {row.reason && <Badge tone={row.kind === 'refund' ? 'info' : 'warn'}>{row.kind === 'review' ? `راجعه: ${row.reason}` : row.reason}</Badge>}
                        {isPost(row) && row.include && isBeforeCountCost(row.line, row.accountId) && <Badge tone="warn">مشتريات قبل الجرد</Badge>}
                        {isPost(row) && hint.account && hint.account._id !== row.accountId && <Badge tone="muted">المقترح: {accountLabel(hint.account)}</Badge>}
                      </td>
                      <td className="text-end">{money(row.line.amount)}</td>
                      <td>
                        {isPost(row) ? (
                          <Autocomplete size="small" options={accounts} value={byId.get(row.accountId) || null}
                            getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                            onChange={(_, a: any) => update(row.line._id, { accountId: a?._id || '', include: !!a })}
                            renderInput={(p) => <TextField {...p} placeholder="اختر الحساب" />} />
                        ) : row.kind === 'refund' ? <span className="acc-muted">استردادات قيد التحديد</span> : <span className="acc-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {!visible.length && <tr><td colSpan={5} className="acc-muted">لا سطور حسب هذا البحث.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <strong>سيُرحّل {chosen.length} سطرًا:</strong>
            {summary.length ? <ul className="mb-0 mt-1">{summary.map((group) => <li key={group.label}>{group.label}: {group.count} سطرًا · {money(group.total)}</li>)}</ul> : <span className="acc-muted"> لا شيء مختار.</span>}
          </div>
          {beforeCount.length > 0 && <Alert severity="warning" className="mt-2">
            {beforeCount.length} سطرًا مشتريات قبل الجرد على حساب تكلفة المشتريات. إن كانت إحداها مسجلة في فاتورة أو طلبية يرفضها الخادم ويذكر الفاتورة.
            <FormControlLabel className="d-block" control={<Checkbox size="small" checked={confirmBeforeCount} onChange={(e) => setConfirmBeforeCount(e.target.checked)} />}
              label="راجعتها: ليست مسجلة في أي فاتورة أو طلبية، وهي تكلفة جديدة قبل الجرد" />
          </Alert>}
          {progress && <div className="mt-2"><LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} /><span className="acc-muted">جارٍ الترحيل {progress.done + 1} / {progress.total}</span></div>}
        </>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!progress}>{result ? 'إغلاق' : 'تراجع'}</Button>
        {!result && <Button variant="contained" color="success" disabled={!!progress || !chosen.length || (beforeCount.length > 0 && !confirmBeforeCount)} onClick={execute}>
          تأكيد وترحيل {chosen.length}
        </Button>}
      </DialogActions>
    </Dialog>
  );
}
