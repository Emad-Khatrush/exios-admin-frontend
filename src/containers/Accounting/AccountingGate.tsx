import { ReactNode } from 'react';
import { useAccountingAccess } from './useAccountingAccess';

// Shows its content only to someone with at least one accounting permission (the main sidebar
// uses it for the Accounting link)
const AccountingGate = ({ children }: { children: ReactNode }) => {
  const access = useAccountingAccess();
  return access.permissions.length ? <>{children}</> : null;
};

export default AccountingGate;
