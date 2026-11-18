import { Debt } from "../../models"
import { checkIfDataArray } from "../../utils/methods"

export const debtPaidAmount = (debt: Pick<Debt, 'initialAmount' | 'amount' | 'manualClosure'>) =>
  Math.max(0, (Number(debt.initialAmount) || 0) - (Number(debt.amount) || 0) - (Number(debt.manualClosure?.writtenOffAmount) || 0));

type DebtsCounter = {
  openedDebtsCount: number
  closedDebtsCount: number
  waitingApprovalDebtsCount: number
  overdueDebtsCount: number
  lostDebtsCount: number
}

export type DebtTab = {
  label: string
  value: Debt['status']
  count: number
}

// The whole debts section (overdue and lost debts, closing a debt manually), as the API allows it:
// admins and accountants, and a staff member whose saved permissions include «الديون». A staff
// member nobody has configured yet keeps the old role rule, which is what the API applies to them.
export const canManageAllDebts = (
  roles: { isAdmin?: boolean, isAccountant?: boolean, [role: string]: any } | undefined,
  access: { full: boolean, configured: boolean, permissions: string[] },
) => !!(roles?.isAdmin || roles?.isAccountant || access.full || (access.configured && access.permissions.includes('debts')));

// The most a payment on a debt can be, in the currency it is paid in. The API turns a payment in
// another currency back into the debt's currency (amount ÷ rate) and refuses more than what is
// left, so this is rounded down to the cent. null: another currency and no rate typed yet.
export const maxDebtPayment = (remaining: number, debtCurrency: string, payCurrency: string, rate: number): number | null => {
  const left = Number(remaining) || 0;
  if (!payCurrency || payCurrency === debtCurrency) return left;
  if (!(Number(rate) > 0)) return null;
  let max = Math.floor(left * Number(rate) * 100 + 1e-6) / 100;
  // The API rounds amount ÷ rate to the cent: step down until that is within the debt
  while (max > 0 && Math.round((max / Number(rate)) * 100) / 100 > left + 1e-6) max = Math.round((max - 0.01) * 100) / 100;
  return max;
};

// The accountant's dinar rate on the payment day and the lowest rate a payment may use (GET payment-rate)
export type DinarRateLimits = { rate: number, minimum: number };

// Dinars paid on a dollar debt, counted the way an order's wallet payment counts them:
// - full: the rate is worked out so the amount closes the debt exactly (rounded up, so it never
//   comes out below the lowest allowed rate by rounding); too low when fewer dinars than that
// - partial: the rate the employee types (never filled in for them), not below the lowest allowed
export const dinarPaymentRate = ({ remaining, amount, mode, typedRate, limits }: {
  remaining: number, amount: number, mode: 'full' | 'partial', typedRate: number, limits: DinarRateLimits | null,
}) => {
  const minimum = limits?.minimum ?? 0;
  const closeFrom = (Number(remaining) || 0) * minimum;
  if (mode === 'full') {
    const closing = amount > 0 && remaining > 0 ? Math.ceil((amount / remaining) * 1000000) / 1000000 : 0;
    return { rate: closing > 0 ? closing : (limits?.rate ?? 0), tooLow: closing > 0 && closing < minimum - 1e-9, closeFrom };
  }
  const rate = typedRate > 0 ? typedRate : 0;
  return { rate, tooLow: rate > 0 && rate < minimum - 1e-9, closeFrom };
};

export const getTabsOfDebts = (countList: DebtsCounter, isAdminOrAccountant: boolean) => {
  const { openedDebtsCount, closedDebtsCount, overdueDebtsCount, lostDebtsCount, waitingApprovalDebtsCount } = countList;

  const debtTabs: DebtTab[] = [
    { label: 'Open', value: 'open', count: openedDebtsCount },
    { label: 'Waiting approval', value: 'waitingApproval', count: waitingApprovalDebtsCount },
    { label: 'Closed', value: 'closed', count: closedDebtsCount },
  ]

  if (isAdminOrAccountant) {
    debtTabs.push(
      { label: 'Overdue', value: 'overdue', count: overdueDebtsCount },
      { label: 'Lost', value: 'lost', count: lostDebtsCount },
    )
  }

  return debtTabs;
}

export const DEBT_STATUS_LABELS: Record<Debt['status'], string> = {
  canceled: 'ملغى',
  open: 'Open',
  waitingApproval: 'Waiting approval',
  closed: 'Closed',
  overdue: 'Overdue',
  lost: 'Lost',
}

export const DEBT_TYPE_LABELS: Record<string, string> = {
  invoice: 'فاتورة شراء',
  receivedGoods: 'شحن',
  general: 'دين عام',
}

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export const formatAmount = (value: number | string | undefined) => numberFormatter.format(Number(value) || 0);

// A list entry is either one debt or an array of debts that belong to the same customer
export const toDebtList = (debt: Debt | Debt[]): Debt[] => (checkIfDataArray(debt) ? (debt as Debt[]) : [debt as Debt]);

export const getInitials = (firstName?: string, lastName?: string) =>
  `${(firstName || '').trim().charAt(0)}${(lastName || '').trim().charAt(0)}` || '?';
