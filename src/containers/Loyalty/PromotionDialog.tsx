import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField } from '@mui/material';
import moment from 'moment-timezone';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { useDialogMotion } from './LoyaltyRtl';

// A points offer as the staff page and the form read it (GET loyalty/promotions)
export type Promotion = {
  _id: string, name: string, multiplierPct: number, startsAt: string, endsAt: string,
  kinds: Kind[], methods: ('air' | 'sea')[], countries: string[], notify: boolean, notifiedAt?: string, endedEarlyAt?: string,
  state: 'upcoming' | 'active' | 'ended', orders: number, bonusPoints: number,
};
type Kind = 'shipping' | 'purchase' | 'remittance';

export const KIND_LABELS: Record<Kind, string> = { shipping: 'الشحن', purchase: 'فواتير الشراء', remittance: 'الحوالات' };
export const COUNTRY_LABELS: Record<string, string> = { china: 'الصين', uae: 'الإمارات', turkey: 'تركيا', usa: 'أمريكا', uk: 'بريطانيا' };
const QUICK = [150, 200, 300];

// Libya days of an offer: the first day, and the last one (endsAt is the midnight after it). Read in
// Libya time whatever the computer's own timezone, so a running offer's days go back unchanged.
const TZ = 'Africa/Tripoli';
export const fromDayOf = (p: Pick<Promotion, 'startsAt'>) => moment.tz(p.startsAt, TZ).format('YYYY-MM-DD');
export const toDayOf = (p: Pick<Promotion, 'endsAt'>) => moment.tz(new Date(p.endsAt).getTime() - 1, TZ).format('YYYY-MM-DD');

// What it covers, in the words the customers' notification uses
export const coverText = (p: Pick<Promotion, 'kinds' | 'methods' | 'countries'>) => {
  const parts: string[] = [];
  if (p.kinds.includes('shipping')) {
    const method = p.methods.length === 1 ? (p.methods[0] === 'air' ? ' الجوي' : ' البحري') : '';
    const countries = p.countries.map((c) => COUNTRY_LABELS[c] || c);
    parts.push(`الشحن${method}${countries.length ? ` من ${countries.join(' و')}` : ''}`);
  }
  if (p.kinds.includes('purchase')) parts.push('فواتير الشراء');
  if (p.kinds.includes('remittance')) parts.push('الحوالات');
  return parts.join(' و');
};

type Props = { open: boolean, promotion: Promotion | null, onClose: () => void, onSaved: () => void };

// Create an offer, or change one. A running offer keeps everything that orders were promised by:
// only its name and the notification can change (the server refuses the rest too).
const PromotionDialog = ({ open, promotion, onClose, onSaved }: Props) => {
  const motion = useDialogMotion();
  const running = promotion?.state === 'active';
  const [name, setName] = useState('');
  const [times, setTimes] = useState('2');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [kinds, setKinds] = useState<Kind[]>(['shipping']);
  const [method, setMethod] = useState<'' | 'air' | 'sea'>('');
  const [countries, setCountries] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(promotion?.name || '');
    setTimes(String((promotion?.multiplierPct || 200) / 100));
    setFromDay(promotion ? fromDayOf(promotion) : moment.tz(TZ).format('YYYY-MM-DD'));
    setToDay(promotion ? toDayOf(promotion) : moment.tz(TZ).add(6, 'days').format('YYYY-MM-DD'));
    setKinds(promotion?.kinds || ['shipping']);
    setMethod(promotion?.methods?.length === 1 ? promotion.methods[0] : '');
    setCountries(promotion?.countries || []);
    setNotify(promotion ? promotion.notify : true);
  }, [open, promotion]);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const multiplierPct = Math.round(Number(times) * 10) * 10;

  const save = async () => {
    setBusy(true);
    setError('');
    const body = { name, multiplierPct, fromDay, toDay, kinds, methods: method ? [method] : [], countries, notify };
    try {
      if (promotion) await api.update(`loyalty/promotions/${promotion._id}`, body);
      else await api.post('loyalty/promotions', body);
      onSaved();
    } catch (e: any) {
      setError(requestError(e, 'لم يُحفظ العرض. حاول مرة أخرى.'));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="sm" className="lp-dialog" {...motion}>
      <DialogTitle>{promotion ? 'تعديل العرض' : 'عرض نقاط جديد'}</DialogTitle>
      <DialogContent dividers>
        <div className="lpr-form" dir="rtl">
          {running && <Alert severity="info">العرض جارٍ: يمكن تغيير اسمه وإبلاغ العملاء فقط. لإيقافه استعمل «إنهاء العرض الآن».</Alert>}
          <TextField label="اسم العرض" value={name} onChange={(e) => setName(e.target.value)} placeholder="الجمعة البيضاء" inputProps={{ maxLength: 60 }} fullWidth autoFocus />

          <div className="lpr-field">
            <span className="lpr-label">المضاعفة</span>
            <div className="lpr-chips">
              {QUICK.map((pct) => (
                <button key={pct} type="button" className={`lpr-chip ${multiplierPct === pct ? 'is-on' : ''}`} disabled={running} onClick={() => setTimes(String(pct / 100))}>×{pct / 100}</button>
              ))}
              <TextField size="small" type="number" label="أو اكتبها" value={times} onChange={(e) => setTimes(e.target.value)} disabled={running}
                inputProps={{ min: 1.1, max: 5, step: 0.1, dir: 'ltr' }} sx={{ width: 120 }} />
            </div>
          </div>

          <div className="lpr-two">
            <TextField type="date" label="من يوم" value={fromDay} onChange={(e) => setFromDay(e.target.value)} disabled={running} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField type="date" label="إلى يوم (آخر يوم)" value={toDay} onChange={(e) => setToDay(e.target.value)} disabled={running} InputLabelProps={{ shrink: true }} fullWidth />
          </div>
          <p className="lp-muted">تدخل في العرض كل طلبية تُنشأ في هذه الأيام (بتوقيت ليبيا)، حتى لو دُفعت واستُلمت بعده.</p>

          <div className="lpr-field">
            <span className="lpr-label">على</span>
            <div className="lpr-chips">
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <FormControlLabel key={k} disabled={running} control={<Checkbox checked={kinds.includes(k)} onChange={() => setKinds(toggle(kinds, k))} />} label={KIND_LABELS[k]} />
              ))}
            </div>
          </div>

          {kinds.includes('shipping') && (
            <>
              <div className="lpr-field">
                <span className="lpr-label">طريقة الشحن</span>
                <div className="lpr-chips">
                  {([['', 'الكل'], ['air', 'جوي'], ['sea', 'بحري']] as const).map(([v, l]) => (
                    <button key={l} type="button" className={`lpr-chip ${method === v ? 'is-on' : ''}`} disabled={running} onClick={() => setMethod(v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="lpr-field">
                <span className="lpr-label">الشحن من</span>
                <div className="lpr-chips">
                  <button type="button" className={`lpr-chip ${!countries.length ? 'is-on' : ''}`} disabled={running} onClick={() => setCountries([])}>كل الدول</button>
                  {Object.entries(COUNTRY_LABELS).map(([k, l]) => (
                    <button key={k} type="button" className={`lpr-chip ${countries.includes(k) ? 'is-on' : ''}`} disabled={running} onClick={() => setCountries(toggle(countries, k))}>{l}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <FormControlLabel control={<Switch checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
            label={promotion?.notifiedAt ? 'أُبلغ العملاء بهذا العرض' : 'أبلغ العملاء بإشعار عند بداية العرض'} disabled={!!promotion?.notifiedAt} />

          {kinds.length > 0 && name.trim() && (
            <div className="lpr-preview">
              <b>🔥 {name.trim()}: نقاطك ×{multiplierPct / 100}</b>
              <span>على {coverText({ kinds, methods: method ? [method] : [], countries })} لكل طلبية تُنشئها حتى {toDay ? moment(toDay).format('DD/MM/YYYY') : '…'}.</span>
            </div>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>إلغاء</Button>
        <Button variant="contained" onClick={save} disabled={busy || !kinds.length || !name.trim()}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromotionDialog;
