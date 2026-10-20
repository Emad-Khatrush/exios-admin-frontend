import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, useMediaQuery } from '@mui/material';
import { CheckCircle2, ExternalLink, HandCoins, ReceiptText, X } from 'lucide-react';
import { Debt } from '../../models';
import CreateDebtHistoryDialog from '../../components/DebtsPage/CreateDebtHistoryDialog';

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const debtTypes: Record<string, string> = { invoice: 'فاتورة شراء', receivedGoods: 'شحن', general: 'دين عام' };
type Props = {
  open: boolean; onClose: () => void; user: any; debts: Debt[]; loading: boolean; error: boolean;
  balances: { walletUsd: number; walletLyd: number }; onRetry: () => Promise<void>; onPaymentSaved: () => Promise<void>;
};

export default function CustomerDebtsDialog(props: Props) {
  const [selected, setSelected] = useState<Debt | null>(null);
  const [success, setSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mobile = useMediaQuery('(max-width:600px)');
  useEffect(() => { if (!props.open) { setSelected(null); setSuccess(false); } }, [props.open]);
  const paid = async () => {
    setSelected(null); setSuccess(true); setRefreshing(true);
    try { await props.onPaymentSaved(); } finally { setRefreshing(false); }
  };
  return <Dialog open={props.open} onClose={selected || refreshing ? undefined : props.onClose} disableEscapeKeyDown={!!selected || refreshing}
    fullWidth maxWidth="md" fullScreen={mobile} className="cw-dialog" aria-labelledby={selected ? undefined : 'cw-debts-title'} PaperProps={{ dir: selected ? 'ltr' : 'rtl' }}>
    {selected ? <CreateDebtHistoryDialog key={selected._id} item={{ ...selected, owner: props.user }} setDialog={() => setSelected(null)} onSaved={() => { void paid(); }} /> : <>
      <DialogTitle id="cw-debts-title" className="cw-dialog-title"><div><strong>الديون المتبقية</strong><p><bdi dir="auto">{[props.user?.firstName, props.user?.lastName].filter(Boolean).join(' ')}</bdi><bdi dir="ltr">{props.user?.customerId}</bdi></p></div><IconButton onClick={props.onClose} disabled={refreshing} aria-label="إغلاق الديون"><X size={20} /></IconButton></DialogTitle>
      <DialogContent dividers className="cw-dialog-content">
        {success && <Alert severity="success" className="cw-payment-success">تم تسجيل السداد بنجاح.</Alert>}
        {props.loading || refreshing ? <div className="cw-dialog-state" role="status"><CircularProgress size={26} /><p>جاري تحديث الديون…</p></div> : props.error ? <div className="cw-dialog-state" role="alert"><ReceiptText size={30} /><h3>تعذر تحميل الديون</h3><p>أعد المحاولة لعرض المبالغ المتبقية.</p><button type="button" className="cw-button" onClick={() => void props.onRetry()}>إعادة المحاولة</button></div> : !props.debts.length ? <div className="cw-dialog-state"><CheckCircle2 size={34} /><h3>لا توجد ديون متبقية</h3><p>لا توجد مبالغ مستحقة ضمن الديون المفتوحة.</p></div> : <>
          <p className="cw-list-hint">{props.debts.length} ديون مفتوحة · اختر الدين لسداد قيمته كاملة أو جزء منها من المحفظة.</p>
          <ul className="cw-debt-list">{props.debts.map(debt => {
            const created = new Date(debt.createdAt);
            const order: any = debt.order;
            const orderId = typeof order === 'string' ? order : order?._id;
            const paidAmount = Math.max(0, Number(debt.initialAmount || debt.amount) - Number(debt.amount));
            return <li key={debt._id}>
              <div className="cw-debt-description"><span className="cw-debt-type">{debtTypes[(debt as any).debtType] || 'دين'}</span><h3 dir="auto">{debt.notes?.trim() || 'بدون بيان إضافي'}</h3><div className="cw-debt-meta">{Number.isFinite(created.getTime()) && <time dateTime={created.toISOString()}>{created.toLocaleDateString('en-GB')}</time>}{orderId && <Link to={`/invoice/${orderId}/edit`}>{order?.orderId ? <>رقم الطلبية <bdi dir="ltr">{order.orderId}</bdi></> : 'فتح الطلبية'}<ExternalLink size={12} aria-hidden="true" /></Link>}</div></div>
              <div className="cw-debt-amount"><span>المتبقي</span><strong dir="ltr">{money(debt.amount)} <small>{debt.currency}</small></strong>{paidAmount > 0 && <small>المسدّد: <bdi dir="ltr">{money(paidAmount)} {debt.currency}</bdi></small>}</div>
              <button className="cw-button cw-button--primary" type="button" aria-label={`سداد ${debt.notes || 'الدين'} ${money(debt.amount)} ${debt.currency}`} onClick={() => { setSuccess(false); setSelected(debt); }}><HandCoins size={16} aria-hidden="true" />سداد</button>
            </li>;
          })}</ul>
        </>}
      </DialogContent>
      <DialogActions className="cw-dialog-actions"><p>المحفظة: <bdi dir="ltr">{money(props.balances.walletUsd)} USD</bdi><span>·</span><bdi dir="ltr">{money(props.balances.walletLyd)} LYD</bdi></p><button className="cw-button" type="button" onClick={props.onClose} disabled={refreshing}>إغلاق</button></DialogActions>
    </>}
  </Dialog>;
}
