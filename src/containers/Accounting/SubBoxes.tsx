import { useCallback, useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { acc, errorText, OFFICE_LABELS } from './accountingApi';
import { AccountRef, Amount, DataTable, Money, Panel } from './ui';

// The offices' sub cash boxes (spec v8): every cash operation staff make in the system lands in
// their office's sub box. The accountant hands the money over to the main box in one step.
export const SubBoxesPanel = ({ canHandOver, onChanged }: { canHandOver?: boolean; onChanged?: () => void }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState<any>(null);
  const load = useCallback(() => {
    acc.get('treasury/sub-boxes').then((res: any) => setRows(res.data.results || [])).catch(() => {});
  }, []);
  useEffect(load, [load]);
  if (!rows.length) return null;
  const handOver = async (row: any) => {
    const amount = row.foreign / 10 ** row.decimals;
    if (!window.confirm(`توريد ${amount} ${row.currency} من ${row.subName} إلى ${row.mainName}؟`)) return;
    try {
      await acc.post(`treasury/sub-boxes/${row.subId}/hand-over`, {});
      setMessage({ type: 'success', text: `وُرِّد ${amount} ${row.currency} إلى ${row.mainName}.` });
      load();
      onChanged?.();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };
  return (
    <Panel flush title="الخزائن الفرعية" subtitle="ما يقبضه الموظفون ويصرفونه نقداً من المنظومة يدخل خزينة مكتبهم الفرعية. ورّده للخزينة الرئيسية عند الاستلام.">
      {message && <Alert severity={message.type} className="mx-3 mb-2" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <DataTable
        dense rows={rows} rowKey={(row: any) => String(row.subId)}
        columns={[
          { key: 'sub', header: 'الخزينة الفرعية', render: (row: any) => <AccountRef code={row.subCode} name={`${row.subName} · ${OFFICE_LABELS[row.office] || row.office}`} /> },
          { key: 'balance', header: 'الرصيد', numeric: true, render: (row: any) => <><Amount value={row.foreign / 10 ** row.decimals} currency={row.currency} />{row.currency !== 'USD' && <div className="acc-sub"><Money value={row.usd} tone="plain" /></div>}</> },
          { key: 'main', header: 'الخزينة الرئيسية', hideOnMobile: true, render: (row: any) => (row.mainCode ? <AccountRef code={row.mainCode} name={row.mainName} /> : '—') },
          ...(canHandOver ? [{
            key: 'actions', header: '', align: 'end' as const, render: (row: any) => (
              <Button size="small" variant="outlined" disabled={!row.mainId || !(row.foreign > 0)} onClick={() => handOver(row)}>توريد للخزينة الرئيسية</Button>
            ),
          }] : []),
        ]}
      />
    </Panel>
  );
};
