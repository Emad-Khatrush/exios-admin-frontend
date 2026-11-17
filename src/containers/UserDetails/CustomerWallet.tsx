import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronLeft, ReceiptText, Wallet } from 'lucide-react';
import { MdToll } from 'react-icons/md';
import { Debt } from '../../models';
import { pointsText, shortDate } from '../Loyalty/format';
import CustomerDebtsDialog from './CustomerDebtsDialog';
import '../Loyalty/loyalty.scss';
import './CustomerWallet.scss';

export const openCustomerDebts = (debts: any): Debt[] => (Array.isArray(debts) ? debts.flat() : [])
  .filter((debt: Debt) => debt && ['open', 'overdue'].includes(debt.status) && Number(debt.amount) > 0);
// The customer's loyalty points, as the page already read them for its header
export type CustomerPoints = { points: number, usd: number, expiringSoon?: { points: number, at: string } | null };

export const customerMoney = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  user: any;
  debts: any;
  debtLoading: boolean;
  debtError: boolean;
  walletUsd: number;
  walletLyd: number;
  // Left out for staff without «الإضافة والخصم من المحفظة»: the button is hidden
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onExchange?: () => void;
  // Left out for staff without the loyalty permission: the points row is hidden
  points?: CustomerPoints | null;
  onOpenPoints?: () => void;
  onRefreshDebts: () => Promise<void>;
  onPaymentSaved: () => Promise<void>;
};

export default function CustomerWallet(props: Props) {
  const [showDebts, setShowDebts] = useState(false);
  const debts = openCustomerDebts(props.debts);
  const total = (currency: string) => debts.reduce((sum, debt) => debt.currency === currency ? sum + Number(debt.amount) : sum, 0);
  const showAmount = (currency: string) => props.debtError ? '—' : props.debtLoading && !props.debts ? '…' : customerMoney(total(currency));
  return <>
    <section className="cw-panel" dir="rtl" aria-label="المحفظة والديون">
      <div className="cw-wallet">
        <header className="cw-heading"><div><h2><Wallet size={19} aria-hidden="true" />محفظة العميل</h2><p>الرصيد المتاح للاستخدام</p></div><span className={`cw-status ${props.walletUsd < 0 || props.walletLyd < 0 ? 'is-negative' : ''}`}>{props.walletUsd < 0 || props.walletLyd < 0 ? 'رصيد سالب' : props.walletUsd === 0 && props.walletLyd === 0 ? 'لا يوجد رصيد' : 'رصيد متاح'}</span></header>
        <dl className={`cw-balances${props.points && props.onOpenPoints ? ' has-points' : ''}`}>
          <div><dt><span className="cw-currency" dir="ltr">USD</span>دولار أمريكي</dt><dd dir="ltr">{customerMoney(props.walletUsd)} <span>$</span></dd></div>
          <div><dt><span className="cw-currency" dir="ltr">LYD</span>دينار ليبي</dt><dd dir="ltr">{customerMoney(props.walletLyd)} <span>د.ل</span></dd></div>
          {/* The loyalty points: a third balance beside the dollar and the dinar, in the coin's gold; it opens the points tab */}
          {props.points && props.onOpenPoints && (
            <div
              className="cw-balance-points lp-coin-tokens" role="button" tabIndex={0} title="فتح تبويب النقاط"
              onClick={props.onOpenPoints}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onOpenPoints?.(); } }}
            >
              <dt><span className="cw-currency cw-currency--points" aria-hidden="true"><MdToll /></span>نقاط الولاء</dt>
              <dd dir="ltr">{pointsText(props.points.points)} <span>نقطة</span></dd>
              <dd className="cw-balance-points__sub">
                = <bdi dir="ltr">${customerMoney(props.points.usd)}</bdi>
                {props.points.expiringSoon && props.points.expiringSoon.points > 0 && (
                  <span className="cw-balance-points__soon"> · تنتهي <bdi dir="ltr">{pointsText(props.points.expiringSoon.points)}</bdi> في <bdi dir="ltr">{shortDate(props.points.expiringSoon.at)}</bdi></span>
                )}
              </dd>
            </div>
          )}
        </dl>
        {(props.onDeposit || props.onWithdraw || props.onExchange) && <div className="cw-actions">{props.onDeposit && <button className="cw-button cw-button--primary" type="button" onClick={props.onDeposit}><ArrowDownLeft size={16} aria-hidden="true" />إضافة رصيد</button>}{props.onWithdraw && <button className="cw-button" type="button" onClick={props.onWithdraw}><ArrowUpRight size={16} aria-hidden="true" />سحب نقدي</button>}{props.onExchange && <button className="cw-button" type="button" onClick={props.onExchange}><ArrowLeftRight size={16} aria-hidden="true" />صرافة داخل المحفظة</button>}</div>}
      </div>
      <div className={`cw-debts ${debts.length ? 'has-debts' : ''}`}>
        <header className="cw-heading"><div><h2><ReceiptText size={18} aria-hidden="true" />الديون المتبقية</h2><p>المبالغ المستحقة على العميل</p></div>{!props.debtError && !props.debtLoading && <span className="cw-debt-count">{debts.length} مفتوحة</span>}</header>
        <dl className="cw-debt-balances"><div><dt>دولار أمريكي</dt><dd dir="ltr">{showAmount('USD')} <span>USD</span></dd></div><div><dt>دينار ليبي</dt><dd dir="ltr">{showAmount('LYD')} <span>LYD</span></dd></div></dl>
        {props.debtError && <p className="cw-error" role="status">تعذر تحديث الديون. افتح القائمة لإعادة المحاولة.</p>}
        <button className="cw-button cw-button--debts" type="button" onClick={() => { setShowDebts(true); void props.onRefreshDebts(); }}>عرض الديون والسداد<ChevronLeft size={16} aria-hidden="true" /></button>
      </div>
    </section>
    <CustomerDebtsDialog open={showDebts} onClose={() => setShowDebts(false)} user={props.user} debts={debts}
      loading={props.debtLoading} error={props.debtError} balances={{ walletUsd: props.walletUsd, walletLyd: props.walletLyd }} onRetry={props.onRefreshDebts} onPaymentSaved={props.onPaymentSaved} />
  </>;
}
