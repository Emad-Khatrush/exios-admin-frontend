import { ReactNode, useState } from 'react';
import { Avatar, AvatarGroup, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Tooltip } from '@mui/material';
import { MdDeleteOutline } from 'react-icons/md';
import moment from 'moment';
import Badge from '../../components/Badge/Badge';
import { convertGoogleStorageUrl } from '../../utils/methods';
import { packageCharge, paidInUsd, totalDebts, totalPaid } from './orderConstants';

type Category = 'invoice' | 'receivedGoods';

type Props = {
  order: any
  isAdmin: boolean
  payments: any[]
  wallet: { walletUsd: number, walletLyd: number }
  // Open debts of the order's customer; the ones made on this order are shown apart
  debts: any[]
  // Opens the wallet dialog to pay the purchase invoice
  onPay: (category: Category, packages: any[], dueUsd: number) => void
  onDeletePayment: (payment: any) => void
  onPreviewImages: (images: any[]) => void
  onConfirmInvoice: () => void
  onRequestEdit: () => void
  onDecideChanges: (status: 'accepted' | 'rejected') => void
  onAddDebt: () => void
}

type Confirm = { title: string, text: ReactNode, action: string, danger?: boolean, run: () => void };

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (value: number) => `$${money(value)}`;

// Total, paid and remaining of one thing the customer pays for, with a bar for the paid part
const Balance = ({ title, total, paid, lydWithoutRate, empty }: { title: string, total: number, paid: number, lydWithoutRate: number, empty: string }) => {
  const remaining = total - paid;
  const share = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;
  const settled = total > 0 && remaining <= 0.005;
  return (
    <div className="op-stat">
      <div className="op-stat__head">
        <span className="op-stat__title">{title}</span>
        {total > 0 && <Badge text={settled ? 'Settled' : paid > 0 ? 'Partly paid' : 'Not paid'} color={settled ? 'success' : paid > 0 ? 'warning' : 'danger'} />}
      </div>
      {total > 0 ? (
        <>
          <strong className="op-stat__value">{remaining > 0.005 ? usd(remaining) : remaining < -0.005 ? `Overpaid ${usd(-remaining)}` : usd(0)}</strong>
          <span className="op-stat__caption">{remaining < -0.005 ? 'more than the total' : 'remaining'}</span>
          <div className="op-bar" role="img" aria-label={`${Math.round(share)}% paid`}><span style={{ width: `${share}%` }} /></div>
          <span className="op-stat__line">{usd(paid)} paid of {usd(total)}</span>
        </>
      ) : <span className="op-stat__line">{empty}</span>}
      {lydWithoutRate > 0 && <span className="op-stat__warn">{money(lydWithoutRate)} LYD was paid with no rate and is not counted here.</span>}
    </div>
  );
};

const PaymentRows = ({ rows, isAdmin, onDelete, onPreviewImages }: { rows: any[], isAdmin: boolean, onDelete: (payment: any) => void, onPreviewImages: (images: any[]) => void }) => {
  if (!rows.length) return <p className="op-muted">No payments recorded yet.</p>;
  return (
    <ul className="op-payments">
      {rows.map((payment) => {
        const rate = Number(payment.rate) || 0;
        return (
          <li key={payment._id}>
            <div className="op-payments__main">
              <strong>{money(payment.receivedAmount)} {payment.currency}</strong>
              <Badge text={payment.paymentType === 'wallet' ? 'Wallet' : 'Cash'} color={payment.paymentType === 'wallet' ? 'primary' : 'sky'} />
              {payment.currency === 'LYD' && (rate > 0
                ? <span className="op-muted">rate {rate}, counts as {usd(payment.receivedAmount / rate)}</span>
                : <span className="op-payments__warn">no rate</span>)}
              {payment.attachments?.length > 0 && (
                <AvatarGroup max={3}>
                  {payment.attachments.map((img: any) => (
                    <Avatar key={img.filename} alt={img.filename} src={convertGoogleStorageUrl(img.path)} onClick={() => onPreviewImages(payment.attachments)} />
                  ))}
                </AvatarGroup>
              )}
              {isAdmin && (
                <Tooltip title="Delete this payment">
                  <IconButton className="op-payments__delete" size="small" color="error" aria-label="Delete this payment" onClick={() => onDelete(payment)}><MdDeleteOutline /></IconButton>
                </Tooltip>
              )}
            </div>
            {(payment.list || []).length > 0 && (
              <ul className="op-payments__packages">
                {payment.list.map((item: any, index: number) => (
                  <li key={item._id || index}>{item.deliveredPackages?.trackingNumber || 'No tracking number'}, {item.deliveredPackages?.weight?.total} {item.deliveredPackages?.weight?.measureUnit}</li>
                ))}
              </ul>
            )}
            {payment.note && <div className="op-payments__note" dir="auto">{payment.note}</div>}
            <span className="op-payments__meta">
              {moment(payment.createdAt).format('DD/MM/YYYY hh:mm A')} by {payment.createdBy ? `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : 'unknown'}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

const CHANGE_STATUS: Record<string, { label: string, color: 'success' | 'danger' }> = {
  accepted: { label: 'Accepted', color: 'success' },
  rejected: { label: 'Rejected', color: 'danger' },
};

const ItemLines = ({ items }: { items: any[] }) => (
  <ul className="op-change__items">
    {(items || []).map((item: any, index: number) => <li key={index} dir="auto">{item.quantity} x {item.unitPrice} $ - {item.description}</li>)}
  </ul>
);

// Requested and past changes to the confirmed invoice
const InvoiceChanges = ({ order, isAdmin, ask, onDecideChanges }: Pick<Props, 'order' | 'isAdmin' | 'onDecideChanges'> & { ask: (confirm: Confirm) => void }) => {
  const requested = order.requestedEditDetails && Object.keys(order.requestedEditDetails).length > 0 ? order.requestedEditDetails : null;
  const history = [...(order.editedAmounts || [])].sort((a: any, b: any) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any));
  if (!requested && !history.length) return null;
  return (
    <section className="op-panel op-panel--wide">
      <h3 className="op-panel__title">Invoice changes</h3>
      {requested && (
        <div className="op-change">
          <Badge color="primary" text="Waiting for approval from admins" />
          <p className="op-change__meta">{moment(requested.createdAt).format('DD/MM/YYYY hh:mm A')}, new total {requested.amount} $</p>
          <ItemLines items={requested.items} />
          {isAdmin && (
            <div className="op-actions op-actions--start">
              <Button
                variant="contained" size="small" type="button"
                onClick={() => ask({ title: 'Accept the new invoice?', text: `The invoice total becomes ${requested.amount} $ and its items are replaced.`, action: 'Accept', run: () => onDecideChanges('accepted') })}
              >
                Accept new invoice
              </Button>
              <Button
                variant="outlined" color="error" size="small" type="button"
                onClick={() => ask({ title: 'Reject the requested change?', text: 'The invoice stays as it is.', action: 'Reject', danger: true, run: () => onDecideChanges('rejected') })}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
      {history.map((change: any, index: number) => (
        <div className="op-change" key={change._id || index}>
          <Badge color={CHANGE_STATUS[change.status]?.color || 'danger'} text={CHANGE_STATUS[change.status]?.label || change.status} />
          <p className="op-change__meta">
            {moment(change.createdAt).format('DD/MM/YYYY hh:mm A')}, <s>{change.oldAmount} $</s> to {change.newAmount} $
          </p>
          <ItemLines items={change.items} />
        </div>
      ))}
    </section>
  );
};

const DEBT_STATUS: Record<string, string> = { open: 'Open', overdue: 'Overdue', waitingApproval: 'Waiting approval', closed: 'Closed', lost: 'Lost' };

// Payments of an order: what is owed and paid at the top, then the payments of the purchase
// invoice, the shipping payments and the debts made on it
const OrderPayments = (props: Props) => {
  const { order, isAdmin, payments, wallet, debts } = props;
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const packages: any[] = order.paymentList || [];
  const invoicePaid = paidInUsd(payments, 'invoice');
  const shippingPaid = paidInUsd(payments, 'receivedGoods');
  const invoiceTotal = Number(order.totalInvoice || 0);
  const shippingTotal = packages.reduce((sum, row) => sum + packageCharge(row), 0);
  const invoiceDue = Math.max(0, invoiceTotal - invoicePaid.usd);

  const onOrder = debts.filter((debt) => String(debt.order?._id || debt.order || '') === String(order._id));
  const elsewhere = debts.filter((debt) => !onOrder.includes(debt));
  const otherTotals = totalDebts(elsewhere);
  const locked = order.invoiceConfirmed || order.requestedEditDetails;
  const walletEmpty = wallet.walletUsd <= 0 && wallet.walletLyd <= 0;

  const deletePayment = (payment: any) => setConfirm({
    title: 'Delete this payment?',
    text: payment.paymentType === 'wallet'
      ? <>The payment of <strong>{money(payment.receivedAmount)} {payment.currency}</strong> is removed from the order and the amount goes back to the customer&apos;s wallet.</>
      : <>The cash payment of <strong>{money(payment.receivedAmount)} {payment.currency}</strong> is removed from the order.</>,
    action: 'Delete payment',
    danger: true,
    run: () => props.onDeletePayment(payment),
  });

  const paidTotals = (category: Category) => {
    const { totalUsd, totalLyd, totalEuro } = totalPaid(payments, category);
    return [totalUsd && `${money(totalUsd)} $`, totalLyd && `${money(totalLyd)} LYD`, totalEuro && `${money(totalEuro)} EURO`].filter(Boolean).join(' + ');
  };

  return (
    <div className="op-payments-grid">
      <section className="op-stats op-panel--wide">
        <Balance title="Purchase invoice" total={invoiceTotal} paid={invoicePaid.usd} lydWithoutRate={invoicePaid.lydWithoutRate} empty="This order has no invoice total." />
        <Balance title="Shipping" total={shippingTotal} paid={shippingPaid.usd} lydWithoutRate={shippingPaid.lydWithoutRate} empty="No package has a weight and a price yet." />
        <div className="op-stat">
          <div className="op-stat__head"><span className="op-stat__title">Customer wallet</span></div>
          <strong className="op-stat__value">{usd(wallet.walletUsd)}</strong>
          <span className="op-stat__caption">and {money(wallet.walletLyd)} LYD</span>
          {order.user?._id && <a className="op-stat__link" href={`/user/${order.user._id}`} target="_blank" rel="noreferrer">Open the wallet</a>}
        </div>
        <div className="op-stat">
          <div className="op-stat__head">
            <span className="op-stat__title">Debts on this order</span>
            {onOrder.length > 0 && <Badge text={`${onOrder.length} open`} color="danger" />}
          </div>
          <strong className="op-stat__value">{onOrder.length ? onOrder.map((debt) => `${money(debt.amount)} ${debt.currency}`).join(' + ') : 'None'}</strong>
          <span className="op-stat__line">
            {elsewhere.length ? `${elsewhere.length} other open debt${elsewhere.length === 1 ? '' : 's'} of this customer: ${money(otherTotals.totalLyd)} LYD, ${money(otherTotals.totalUsd)} USD` : 'The customer has no other open debts.'}
          </span>
        </div>
      </section>

      <InvoiceChanges order={order} isAdmin={isAdmin} ask={setConfirm} onDecideChanges={props.onDecideChanges} />

      <section className="op-panel">
        <header className="op-panel__head">
          <div>
            <h3 className="op-panel__title">Purchase invoice</h3>
            <p className="op-panel__hint">
              Total <strong>{usd(invoiceTotal)}</strong>
              {paidTotals('invoice') && <>, received {paidTotals('invoice')}</>}
            </p>
          </div>
          <Badge text={order.invoiceConfirmed ? 'Confirmed' : 'Not confirmed'} color={order.invoiceConfirmed ? 'success' : 'warning'} />
        </header>
        <div className="op-actions op-actions--start">
          <Button variant="contained" size="small" type="button" onClick={() => props.onPay('invoice', [], invoiceDue)} disabled={walletEmpty}>Pay from wallet</Button>
          {isAdmin && (locked ? (
            <Button variant="outlined" size="small" type="button" onClick={props.onRequestEdit}>Request invoice edit</Button>
          ) : (
            <Button
              variant="outlined" size="small" type="button"
              onClick={() => setConfirm({
                title: 'Confirm this invoice?',
                text: <>The invoice is confirmed at <strong>{usd(invoiceTotal)}</strong>. Its items are locked after this; a later change needs an edit request.</>,
                action: 'Confirm invoice',
                run: props.onConfirmInvoice,
              })}
            >
              Confirm invoice
            </Button>
          ))}
          {walletEmpty && <span className="op-muted">The wallet is empty</span>}
        </div>
        <PaymentRows rows={payments.filter((payment) => payment.category === 'invoice')} isAdmin={isAdmin} onDelete={deletePayment} onPreviewImages={props.onPreviewImages} />
      </section>

      <section className="op-panel">
        <header className="op-panel__head">
          <div>
            <h3 className="op-panel__title">Shipping payments</h3>
            <p className="op-panel__hint">
              Total <strong>{usd(shippingTotal)}</strong>
              {paidTotals('receivedGoods') && <>, received {paidTotals('receivedGoods')}</>}
            </p>
          </div>
        </header>

        <PaymentRows rows={payments.filter((payment) => payment.category === 'receivedGoods')} isAdmin={isAdmin} onDelete={deletePayment} onPreviewImages={props.onPreviewImages} />
      </section>

      <section className="op-panel op-panel--wide">
        <header className="op-panel__head">
          <div>
            <h3 className="op-panel__title">Debts on this order</h3>
            <p className="op-panel__hint">What the customer took on credit for this order and has not paid back.</p>
          </div>
          <Button variant="outlined" size="small" type="button" onClick={props.onAddDebt}>Add debt</Button>
        </header>
        {onOrder.length === 0 && <p className="op-muted">No open debt is linked to this order.</p>}
        <ul className="op-debts">
          {onOrder.map((debt: any) => (
            <li key={debt._id}>
              <strong>{money(debt.amount)} {debt.currency}</strong>
              <Badge text={DEBT_STATUS[debt.status] || debt.status} color={debt.status === 'open' ? 'warning' : 'danger'} />
              {Number(debt.initialAmount) > Number(debt.amount) && <span className="op-muted">of {money(debt.initialAmount)} {debt.currency}, {money(debt.initialAmount - debt.amount)} paid back</span>}
              <span className="op-muted">{moment(debt.createdAt).format('DD/MM/YYYY')}</span>
              {debt.notes && <span className="op-debts__note" dir="auto">{debt.notes}</span>}
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.text}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Back</Button>
          <Button variant="contained" color={confirm?.danger ? 'error' : 'primary'} autoFocus onClick={() => { confirm?.run(); setConfirm(null); }}>{confirm?.action}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default OrderPayments;
