import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogContent, LinearProgress } from '@mui/material';

// What the bank page knows about a statement import running in the background on the server
export type ImportProgressState = {
  status: 'reading' | 'starting' | 'running' | 'failed' | 'lost'
  phase?: 'saving' | 'posting' | 'done'
  done?: number
  total?: number
  rows?: number
  startedAt: number
  // When the numbers last moved: a long silence is shown so a stuck import is not mistaken for a slow one
  lastChange: number
  error?: string
  joined?: boolean
  fileName?: string
};

const STALL_SECONDS = 60;

export const importPercent = (state: ImportProgressState) => {
  if (state.status === 'reading' || state.status === 'starting' || state.phase === 'saving' || !state.phase) return null;
  if (state.phase === 'done') return 100;
  const total = state.total || 0;
  return total ? Math.min(99, Math.round(10 + (90 * (state.done || 0)) / total)) : 95;
};

const seconds = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} ث` : `${Math.floor(s / 60)} د ${s % 60} ث`;
};

// A dimmed screen over the page while a statement is read or imported: what is happening, how far
// it is, and — if it stops — that it stopped and why, instead of a page that silently waits.
export default function BankImportProgress({ state, onClose, onKeepWaiting }: {
  state: ImportProgressState | null; onClose: () => void; onKeepWaiting: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const active = !!state && !['failed', 'lost'].includes(state.status);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  if (!state) return null;
  const percent = importPercent(state);
  const stalled = active && state.status !== 'reading' && now - state.lastChange > STALL_SECONDS * 1000;
  const title = state.status === 'reading' ? 'جارٍ قراءة الكشف…'
    : state.status === 'failed' ? 'توقف الاستيراد'
      : state.status === 'lost' ? 'انقطع الاتصال بعملية الاستيراد'
        : 'جارٍ استيراد الكشف…';
  const step = state.status === 'reading' ? 'قراءة الملف وتحويله إلى سطور'
    : state.status === 'starting' ? 'إرسال السطور إلى الخادم'
      : state.phase === 'saving' ? `حفظ ${state.rows ?? state.total ?? ''} سطر ومطابقة ما في الدفاتر`
        : state.phase === 'posting' ? (state.total ? `ترحيل السطور على حساباتها: ${state.done || 0} من ${state.total}` : 'إنهاء الاستيراد')
          : 'اكتمل';

  return (
    // A dialog (focus kept inside, readable by screen readers) over a dimmed page; it cannot be
    // dismissed by a stray click or Escape while the import is still running
    <Dialog open fullWidth maxWidth="xs" dir="rtl" aria-labelledby="bank-import-progress-title"
      onClose={() => { if (!active) onClose(); }} disableEscapeKeyDown={active}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }} PaperProps={{ sx: { borderRadius: 3 } }}
      BackdropProps={{ sx: { bgcolor: 'rgba(15, 23, 32, 0.55)' } }}>
      <DialogContent sx={{ p: 3 }} role="status" aria-live="polite">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <strong id="bank-import-progress-title" style={{ fontSize: 17 }}>{title}</strong>
          {active && percent !== null && <span dir="ltr" style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>}
        </div>
        {state.fileName && <div className="acc-sub" style={{ marginTop: 2 }}>{state.fileName}</div>}

        {active && <>
          <LinearProgress sx={{ mt: 2, height: 8, borderRadius: 4 }} variant={percent === null ? 'indeterminate' : 'determinate'} value={percent ?? undefined} />
          <div style={{ marginTop: 10, fontSize: 14 }}>{step}</div>
          <div className="acc-sub" style={{ marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            الوقت المنقضي: {seconds(now - state.startedAt)}{state.status !== 'reading' && ` · آخر تقدم قبل ${seconds(now - state.lastChange)}`}
          </div>
          {state.joined && <Alert severity="info" sx={{ mt: 2 }}>يوجد استيراد جارٍ لهذا الحساب بالفعل؛ نتابعه بدل بدء استيراد ثانٍ.</Alert>}
          {stalled && <Alert severity="warning" sx={{ mt: 2 }}>
            لم يتقدم الاستيراد منذ أكثر من دقيقة. ما زال يعمل على الخادم وقد يكون سطرًا ثقيلًا؛ لا تضغط استيراد مرة أخرى. إن طال الانتظار أغلق هذه النافذة وحدّث الصفحة لاحقًا — إعادة استيراد نفس الملف لا تكرر السطور.
          </Alert>}
          {state.status !== 'reading' && <div className="acc-sub" style={{ marginTop: 12 }}>يمكنك ترك الصفحة مفتوحة؛ الاستيراد يكمل على الخادم.</div>}
        </>}

        {state.status === 'failed' && <Alert severity="error" sx={{ mt: 2 }}>
          {state.error || 'تعذر الاستيراد.'}
          {state.phase === 'posting' && <div style={{ marginTop: 6 }}>حُفظت سطور الكشف قبل التوقف؛ راجع «غير مطابق» وأكمل ما لم يُرحَّل.</div>}
        </Alert>}
        {state.status === 'lost' && <Alert severity="warning" sx={{ mt: 2 }}>
          {state.error || 'لم يرد الخادم على متابعة الاستيراد عدة مرات.'} قد يكون الاستيراد ما زال يعمل أو انتهى. لا تعد الاستيراد الآن؛ تابع الانتظار أو أغلق وحدّث الصفحة لترى السطور.
        </Alert>}
        {!active && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {state.status === 'lost' && <Button onClick={onKeepWaiting}>متابعة الانتظار</Button>}
          <Button variant="contained" onClick={onClose}>إغلاق</Button>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
