import { Button } from '@mui/material';
import { Badge, Ltr, Sub } from './ui';
import { acc } from './accountingApi';

export const WALLET_REFUND_LINK_MESSAGE = 'رُبطت حركة الكشف بإضافة المحفظة السابقة دون تغيير الأرصدة. ترحيل أو مطابقة البنك يبقى مستقلًا.';

export default function LinkedWalletRefundInfo({ row, run }: any) {
  const statement = row.legacyWalletStatementId;
  if (!statement) return null;
  return <Sub><Badge tone="info">مرتبط بإضافة محفظة سابقة</Badge> · {statement.user?.firstName} {statement.user?.lastName} · <Ltr>{statement.amount} {statement.currency}</Ltr> · ربط مرجعي دون قيد جديد
    <Button size="small" onClick={() => run(() => acc.post(`bank/lines/${row._id}/unlink-wallet-refund`), () => 'فُك الربط المرجعي؛ الأرصدة والقيود محفوظة.')}>فك الربط</Button>
  </Sub>;
}
