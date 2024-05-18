import Badge from "../Badge/Badge"

type DebtsCounter = {
  openedDebtsCount: number
  closedDebtsCount: number
  waitingApprovalDebtsCount: number
  overdueDebtsCount: number
  lostDebtsCount: number
}

export const getTabsOfDebts = (countList: DebtsCounter, isAdminOrAccountant: boolean) => {
  const debtTabs: any = []
  const { openedDebtsCount, closedDebtsCount, overdueDebtsCount, lostDebtsCount, waitingApprovalDebtsCount } = countList;

  debtTabs.push(
    {
      label: 'Opened Debts',
      value: 'open',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(openedDebtsCount)} color="primary" />
    },
    {
      label: 'Waiting Approval',
      value: 'waitingApproval',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(waitingApprovalDebtsCount)} color="sky" />
    },
    {
      label: 'Closed Debts',
      value: 'closed',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(closedDebtsCount)} color="success" />
    },
  )

  if (isAdminOrAccountant) {
    debtTabs.push(
      {
        label: 'Overdue Debts',
        value: 'overdue',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(overdueDebtsCount)} color="warning" />
  
      },
      {
        label: 'Lost Debts',
        value: 'lost',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(lostDebtsCount)} color="danger" />
      }
    )
  }

  return debtTabs;
}

