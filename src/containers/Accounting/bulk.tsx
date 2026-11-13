import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';

export type BulkAction<T> = {
  key: string;
  label: string;
  // Rows this action can be applied to; the others in the selection are left alone
  applies: (row: T) => boolean;
  run: (row: T, reason: string) => Promise<any>;
  // Past tense for the result line, e.g. "رُحِّلت"
  done: string;
  // Asked before running; with `needsReason` a reason is typed once and sent with every row
  confirm: (count: number) => string;
  needsReason?: boolean;
  // The field's label when the reason is not a cancellation (e.g. "what were these operations")
  reasonLabel?: string;
  danger?: boolean;
  // Starts a new group in the bar (a thin divider before it)
  group?: string;
};

// Cancelling posted documents of one kind: one reason, a reversing entry for each
export const cancelAction = (model: string, label: string, effect: string, applies: (row: any) => boolean = (row) => row.status === 'posted'): BulkAction<any> => ({
  key: 'cancel', label, done: 'أُلغي', danger: true, needsReason: true, applies,
  run: (row, reason) => acc.post(`documents/${model}/${row._id}/cancel`, { reason }),
  confirm: (count) => `سيُلغى ${count} مستنداً بقيد عكسي لكل منها، وتبقى ظاهرة بحالة «ملغى». ${effect}`,
});

// Checkbox selection for a DataTable plus the bar of actions on the selected rows. Each action
// runs row by row through the same endpoint as the single-row button, so every server rule
// still applies; rows the server refuses are listed with its reason.
export function useBulk<T>({
  rows, rowKey, rowLabel, actions, onDone, lead, extra,
}: {
  rows: T[]; rowKey: (row: T) => string; rowLabel: (row: T) => string; actions: BulkAction<T>[]; onDone: () => any;
  // Page buttons shown in the same bar: `lead` first (the main action), `extra` after the actions.
  // Buttons that depend on the selection go through the returned `barWith` instead.
  lead?: ReactNode; extra?: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<BulkAction<T> | null>(null);
  const [reason, setReason] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ text: string; failures: string[] } | null>(null);

  // Rows that left the list (reload, filter, page) leave the selection too
  useEffect(() => {
    const present = new Set(rows.map(rowKey));
    setSelected((current) => {
      const kept = Array.from(current).filter((key) => present.has(key));
      return kept.length === current.size ? current : new Set(kept);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const picked = useMemo(() => rows.filter((row) => selected.has(rowKey(row))), [rows, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const targets = (action: BulkAction<T>) => picked.filter(action.applies);

  const execute = async () => {
    const action = pending!;
    const list = targets(action);
    setPending(null);
    setResult(null);
    const failures: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress({ done: i, total: list.length });
      try {
        await action.run(list[i], reason.trim());
      } catch (err) {
        failures.push(`${rowLabel(list[i])}: ${errorText(err)}`);
      }
    }
    setProgress(null);
    setReason('');
    setSelected(new Set());
    setResult({ text: `${action.done} ${list.length - failures.length} من ${list.length}.`, failures });
    await onDone();
  };

  const selection = {
    selected,
    onChange: setSelected,
    selectable: (row: T) => actions.some((action) => action.applies(row)),
  };

  // `barWith(lead, extra)`: the bar with page buttons that depend on the selection itself
  const barWith = (lead?: ReactNode, extra?: ReactNode): ReactNode => (
    <>
      {result && (
        <Alert severity={result.failures.length ? 'warning' : 'success'} className="mx-3 mb-2" onClose={() => setResult(null)}>
          {result.text}
          {result.failures.length > 0 && <ul className="mb-0 mt-1">{result.failures.map((failure) => <li key={failure}>{failure}</li>)}</ul>}
        </Alert>
      )}
      {(selected.size > 0 || progress) && (
        <div className="acc-bulk">
          <span className="acc-bulk__count">{progress ? `جارٍ التنفيذ ${progress.done + 1} / ${progress.total}` : `${selected.size} محدد`}</span>
          {!progress && lead}
          {!progress && actions.filter((action) => targets(action).length > 0).map((action, index, shown) => (
            <span key={action.key} className="acc-bulk__item">
              {(index > 0 ? action.group !== shown[index - 1].group : !!lead) && <span className="acc-bulk__sep" aria-hidden />}
              <Button size="small" variant="outlined" color={action.danger ? 'error' : 'primary'} onClick={() => { setReason(''); setPending(action); }}>
                {action.label} ({targets(action).length})
              </Button>
            </span>
          ))}
          {!progress && extra && <><span className="acc-bulk__sep" aria-hidden />{extra}</>}
          {!progress && <Button size="small" color="inherit" className="acc-bulk__clear" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>}
        </div>
      )}
      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="sm" fullWidth dir="rtl">
        <DialogTitle>{pending?.label}</DialogTitle>
        <DialogContent>
          <p className="acc-muted">{pending?.confirm(pending ? targets(pending).length : 0)}</p>
          {pending?.needsReason && <TextField label={pending?.reasonLabel || 'السبب (يُسجَّل على كل مستند)'} value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} required className="mt-2" />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>تراجع</Button>
          <Button variant="contained" color={pending?.danger ? 'error' : 'primary'} disabled={!!pending?.needsReason && !reason.trim()} onClick={execute}>تأكيد</Button>
        </DialogActions>
      </Dialog>
    </>
  );

  return { selection, bar: barWith(lead, extra), barWith };
}
