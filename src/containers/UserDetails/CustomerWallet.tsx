import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronLeft, ReceiptText, Wallet } from 'lucide-react';
import { Debt } from '../../models';
import CustomerDebtsDialog from './CustomerDebtsDialog';
import './CustomerWallet.scss';

export const openCustomerDebts = (debts: any): Debt[] => (Array.isArray(debts) ? debts.flat() : [])
  .filter((debt: Debt) => debt && ['open', 'overdue'].includes(debt.status) && Number(debt.amount) > 0);
export const customerMoney = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  user: any;
  debts: any;
  debtLoading: boolean;
  debtError: boolean;
  walletUsd: number;
  walletLyd: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onExchange?: () => void;
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
        <dl className="cw-balances">
          <div><dt><span className="cw-currency" dir="ltr">USD</span>دولار أمريكي</dt><dd dir="ltr">{customerMoney(props.walletUsd)} <span>$</span></dd></div>
          <div><dt><span className="cw-currency" dir="ltr">LYD</span>دينار ليبي</dt><dd dir="ltr">{customerMoney(props.walletLyd)} <span>د.ل</span></dd></div>
        </dl>
        <div className="cw-actions"><button className="cw-button cw-button--primary" type="button" onClick={props.onDeposit}><ArrowDownLeft size={16} aria-hidden="true" />إضافة رصيد</button><button className="cw-button" type="button" onClick={props.onWithdraw}><ArrowUpRight size={16} aria-hidden="true" />سحب نقدي</button>{props.onExchange && <button className="cw-button" type="button" onClick={props.onExchange}><ArrowLeftRight size={16} aria-hidden="true" />صرافة داخل المحفظة</button>}</div>
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
