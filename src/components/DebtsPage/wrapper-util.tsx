import { Debt } from "../../models"
import { checkIfDataArray } from "../../utils/methods"

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
