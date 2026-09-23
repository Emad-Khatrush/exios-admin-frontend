import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Wallet } from 'lucide-react';
import Card from '../../components/Card/Card';
import PaymentDetails from './PaymentDetails';
import { formatMoney } from './statementUtils';
import UserStatementDesign from './UserStatementDesign';
import { recalculateStatementTotals } from '../../utils/methods';
import { canManageStatements } from '../../constants/permissions';
// Styles are handled by the bundler; TypeScript has no declaration for SCSS imports.
// @ts-ignore
import './CashflowUser.scss';

type Props = {
  userStatement: any
  onChangeCurrency: (value: string) => void
  onStatementChanged: () => void
  isLoading: boolean
}

const currencies = [
  { value: 'USD', label: 'USD account' },
  { value: 'LYD', label: 'LYD account' },
];

const CashflowUser = (props: Props) => {
  const [statementCurrency, setStatementCurrency] = useState('USD');
  const { userStatement, isLoading } = props;
  const canManage = useSelector((state: any) => canManageStatements(state.session.account));

  // Oldest first with totals rebuilt by date
  const chronological = useMemo(() => recalculateStatementTotals(userStatement || []), [userStatement]);
  const newestFirst = useMemo(() => [...chronological].reverse(), [chronological]);

  const summary = useMemo(() => {
    return chronological.reduce((acc: any, statement: any) => {
      const amount = Number(statement.amount || 0);
      if (statement.calculationType === '-') acc.out += amount;
      else acc.in += amount;
      return acc;
    }, { in: 0, out: 0 });
  }, [chronological]);

  const balance = chronological.length ? chronological[chronological.length - 1].total : 0;

  return (
    <Card bodyStyle={{ marginTop: '4px' }}>
      <div className="cashflow">
        <header className="cashflow__header">
          <div>
            <h5 className="cashflow__title">Cashflow statement</h5>
            <p className="cashflow__subtitle">
              {isLoading ? 'Loading transactions…' : `${chronological.length} transactions, sorted by date`}
            </p>
          </div>

          <div className="cashflow__controls">
            <div className="cashflow__segmented" role="tablist" aria-label="Statement currency">
              {currencies.map((currency) => (
                <button
                  key={currency.value}
                  type="button"
                  role="tab"
                  aria-selected={statementCurrency === currency.value}
                  className={statementCurrency === currency.value ? 'is-active' : ''}
                  onClick={() => {
                    if (statementCurrency === currency.value) return;
                    setStatementCurrency(currency.value);
                    props.onChangeCurrency(currency.value);
                  }}
                >
                  {currency.label}
                </button>
              ))}
            </div>
            {chronological.length > 0 && <UserStatementDesign userStatements={chronological} />}
          </div>
        </header>

        <section className="cashflow__summary">
          <div className="cashflow__stat cashflow__stat--primary">
            <span className="cashflow__stat-label">Current balance</span>
            <span className={`cashflow__stat-value ${balance < 0 ? 'is-negative' : ''}`}>
              {formatMoney(balance, statementCurrency)}
            </span>
          </div>
          <div className="cashflow__stat">
            <span className="cashflow__stat-label">Money in</span>
            <span className="cashflow__stat-value is-positive">+{formatMoney(summary.in, statementCurrency)}</span>
          </div>
          <div className="cashflow__stat">
            <span className="cashflow__stat-label">Money out</span>
            <span className="cashflow__stat-value is-negative">−{formatMoney(summary.out, statementCurrency)}</span>
          </div>
        </section>

        <div className="cashflow__list-head" aria-hidden>
          <span>Date</span>
          <span>Description</span>
          <span className="text-end">Amount</span>
          <span className="text-end">Balance</span>
          <span className="text-end">Actions</span>
        </div>

        <div className="cashflow__list">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="cashflow-row cashflow-row--skeleton">
                <span className="skeleton" style={{ width: 44, height: 36 }} />
                <span className="skeleton" style={{ width: `${55 + (index * 9) % 30}%`, height: 14 }} />
                <span className="skeleton" style={{ width: 80, height: 14 }} />
                <span className="skeleton" style={{ width: 80, height: 14 }} />
                <span className="skeleton" style={{ width: 110, height: 28 }} />
              </div>
            ))
          ) : newestFirst.length === 0 ? (
            <div className="cashflow__empty">
              <Wallet size={28} strokeWidth={1.5} />
              <p className="m-0 fw-semibold">No {statementCurrency} transactions yet</p>
              <p className="m-0">Payments, debts and wallet movements for this account will show up here.</p>
            </div>
          ) : (
            newestFirst.map((statement: any, index: number) => (
              <PaymentDetails
                key={statement._id}
                statement={statement}
                canManage={canManage}
                onChanged={props.onStatementChanged}
                style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
              />
            ))
          )}
        </div>
      </div>
    </Card>
  )
}

export default CashflowUser;
