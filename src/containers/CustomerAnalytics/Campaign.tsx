import { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { Send } from 'lucide-react';
import api from '../../api';
import { useStaffAccess } from '../../utils/useStaffAccess';
import { requestError } from '../Loyalty/PaymentPoints';
import { count } from './format';
import { useFullList } from './fullList';
import { Num } from './shared';

type Query = Record<string, string | number | null | undefined>

// The |word| placeholders the API's replaceWords() fills (same as the Marketing page)
const VARIABLES: [string, string][] = [['fullName', 'الاسم الكامل'], ['customerId', 'كود العميل'], ['phone', 'الهاتف']];
const MAX = 5000;

const sendError = (e: any) => {
  const code = e?.response?.data?.message;
  if (code === 'whatsup-auth-not-found') return 'واتساب غير مربوط. امسح رمز QR من صفحة التسويق أولاً.';
  return requestError(e, 'تعذّر إرسال الحملة. أعد المحاولة.');
};

// «أرسل حملة واتساب» to every customer of a list (lost / at risk, waiting, an RFM segment, low ratings).
// Shown only to who may use marketing. Reads all the list's ids (limit=all) and posts them as a
// customList campaign (CONTRACT.md «campaign from a list»).
export const CampaignButton = ({ section, query, pick, total, listName }: {
  section: string, query: Query, pick: (data: any) => { id: string }[] | undefined, total: number, listName: string
}) => {
  const staff = useStaffAccess();
  const fetchAll = useFullList();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'write' | 'confirm'>('write');
  const [content, setContent] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean, text: string } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  if (!staff.can('marketing')) return null;

  const close = () => {
    if (busy) return;
    if (result?.ok) { setContent(''); setImgUrl(''); }
    setOpen(false); setStep('write'); setResult(null);
  };
  const insert = (key: string) => {
    const token = `|${key}|`;
    const el = box.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + token + content.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const rows = await fetchAll(section, query, pick);
      const userIds = Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
      if (!userIds.length) throw new Error('empty');
      if (userIds.length > MAX) {
        setResult({ ok: false, text: `القائمة فيها ${count(userIds.length)} عميل، والحد ${count(MAX)} في الحملة الواحدة. ضيّق القائمة (المكتب أو المدة) ثم أعد المحاولة.` });
        return;
      }
      const res = await api.post('sendMessagesToClients', { target: 'customList', userIds, content, imgUrl: imgUrl.trim() || undefined });
      const apiText = res?.data?.message;
      setResult({ ok: true, text: `أُنشئت الحملة إلى ${count(userIds.length)} عميل. تتابعها في صفحة التسويق.${apiText ? ` (${apiText})` : ''}` });
    } catch (e: any) {
      setResult({ ok: false, text: e?.message === 'empty' ? 'القائمة فارغة الآن.' : sendError(e) });
    } finally {
      setBusy(false);
    }
  };

  const sent = !!result?.ok;
  return (
    <>
      <Button variant="outlined" size="small" startIcon={<Send size={16} />} onClick={() => setOpen(true)} disabled={!total}>أرسل حملة واتساب</Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" dir="rtl">
        <DialogTitle>حملة واتساب إلى «{listName}»</DialogTitle>
        <DialogContent className="ca-dialog">
          <p className="ca-dialog__lead">
            المستلمون: <strong><Num>{count(total)}</Num></strong> عميل (كل القائمة، لا الصفحة المعروضة فقط).
            لا تصل الرسالة لمن أُلغي حسابه أو ليس له رقم هاتف. تخرج الرسائل واحدة كل دقيقة إلى دقيقتين.
          </p>
          {step === 'write' ? (
            <>
              <TextField
                label="نص الرسالة" multiline minRows={6} fullWidth value={content} inputRef={box}
                onChange={(e) => setContent(e.target.value)} placeholder="اكتب الرسالة هنا…" inputProps={{ dir: 'rtl' }}
              />
              <div className="ca-vars">
                <span>أدرج:</span>
                {VARIABLES.map(([key, label]) => (
                  <button key={key} type="button" onClick={() => insert(key)}>{label} <bdi dir="ltr">|{key}|</bdi></button>
                ))}
              </div>
              <TextField label="رابط صورة (اختياري)" fullWidth size="small" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…" inputProps={{ dir: 'ltr' }} />
            </>
          ) : (
            <div className="ca-dialog__confirm">
              <p>ستُرسل هذه الرسالة إلى <strong><Num>{count(total)}</Num></strong> عميل. لا يمكن التراجع بعد الإنشاء (يمكن حذف الحملة من صفحة التسويق).</p>
              <blockquote dir="rtl">{content}</blockquote>
              {imgUrl.trim() && <p className="ca-muted">مع صورة: <bdi dir="ltr">{imgUrl.trim()}</bdi></p>}
            </div>
          )}
          {result && <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 2 }}>{result.text}</Alert>}
        </DialogContent>
        <DialogActions>
          {sent ? <Button onClick={close}>إغلاق</Button> : step === 'write' ? (
            <>
              <Button onClick={close}>إلغاء</Button>
              <Button variant="contained" onClick={() => setStep('confirm')} disabled={!content.trim() || !total}>التالي</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setStep('write')} disabled={busy}>رجوع</Button>
              <Button variant="contained" startIcon={<Send size={16} />} onClick={send} disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'تأكيد الإرسال'}</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
