import { Debt } from "../../models";

import DebtHistory from "./DebtHistory";
import DebtorInfo from "./DebtorInfo";
import { formatAmount, toDebtList } from "./wrapper-util";

type Props = {
  debt: Debt | Debt[]
  setDialog: (state: any) => void
  fetchData: () => void
}

const DebtDetails = (props: Props) => {
  // A list entry is an array when a customer has more than one debt
  const debts = toDebtList(props.debt);
  const userOwnDebt: Debt = debts.find(d => d.status === 'open') || debts[0];
  const isOwed = userOwnDebt?.status === 'open' || userOwnDebt?.status === 'overdue';

  // Open debts show what is still owed, everything else shows what was actually paid
  const totals = sumByCurrency(debts, isOwed ? 'amount' : 'paid');

  return (
    <article className="debtor-card">
      <DebtorInfo
        firstName={userOwnDebt?.owner?.firstName}
        lastName={userOwnDebt?.owner?.lastName}
        phoneNumber={userOwnDebt?.owner?.phone}
        customerId={userOwnDebt?.owner?.customerId}
      />

      <div className="debtor-total">
        <span className="debtor-total-label">
          {isOwed ? 'Total owed' : 'Total paid'}
          {debts.length > 1 && ` across ${debts.length} debts`}
        </span>
        <span className={`debtor-total-value ${isOwed ? 'is-owed' : 'is-paid'}`}>
          {totals.LYD > 0 && <span>{formatAmount(totals.LYD)}<small>LYD</small></span>}
          {totals.USD > 0 && <span>{formatAmount(totals.USD)}<small>USD</small></span>}
          {totals.LYD <= 0 && totals.USD <= 0 && <span>0</span>}
        </span>
      </div>

      <div className="debtor-debts">
        {debts.map((currentDebt: Debt) => (
          <DebtHistory
            key={currentDebt._id}
            debt={currentDebt}
            setDialog={props.setDialog}
            fetchData={props.fetchData}
          />
        ))}
      </div>
    </article>
  )
}

const sumByCurrency = (debts: Debt[], field: 'amount' | 'paid') => {
  const totals = { LYD: 0, USD: 0 };
  debts.forEach((debt) => {
    if (debt.currency === 'USD' || debt.currency === 'LYD') {
      // A manually closed debt was only paid up to what was written off to lost
      const value = field === 'amount'
        ? Number(debt.amount) || 0
        : (Number(debt.initialAmount) || 0) - (Number(debt.manualClosure?.writtenOffAmount) || 0);
      totals[debt.currency] += value;
    }
  });
  return totals;
}

export default DebtDetails;
