import { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { errorText, newKey, sys } from '../Accounting/accountingApi';

// Gives back part of what the customer paid on the order to their wallet, with a description (owner
// 2026-11-25): the invoice lowered after it was paid (200$ paid, now 180$), the 20$ goes back without
// cancelling the 200$ payment. In dollars, or in dinars at a rate (never above the accountant's rate
// plus the tolerance). The API caps it: the invoice at the money paid on it (less earlier returns and
// supplier refunds; more than the extra makes it owed again); the shipping at its extra only. Points
// paid on the invoice are never given back as money.

type Category = 'invoice' | 'receivedGoods';
type Part = { maxUsd: number, extraUsd: number, pointsUsd: number };
type Room = Part & { lyd: { rate: number, maximum: number } | null };
type Props = { orderId: string, category?: Category, open: boolean, onClose: () => void, onDone: (message: string) => void };

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (value: number) => Math.round(value * 100) / 100;
const TITLES: Record<Category, string> = { invoice: 'إرجاع مبلغ من دفعات الفاتورة', receivedGoods: 'إرجاع مبلغ من دفعات الشحن' };

const PaymentReturnDialog = ({ orderId, category = 'invoice', open, onClose, onDone }: Props) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LYD'>('USD');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const key = useRef(newKey());

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setRoom(null); setLoadError(''); setError(''); setDescription(''); setCurrency('USD');
    key.current = newKey();
    sys.get(`acc/orders/${orderId}/payment-returns`)
      .then((res: any) => {
        if (stale) return;
        const part = res.data?.parts?.[category] || { maxUsd: res.data?.returnableUsd, extraUsd: res.data?.extraUsd, pointsUsd: res.data?.pointsUsd };
        const next: Room = { maxUsd: Number(part.maxUsd) || 0, extraUsd: Number(part.extraUsd) || 0, pointsUsd: Number(part.pointsUsd) || 0, lyd: res.data?.lyd || null };
        setRoom(next);
        setAmount(next.extraUsd > 0 ? String(round2(next.extraUsd)) : '');
        setRate(next.lyd ? String(next.lyd.rate) : '');
      })
      .catch((err: any) => { if (!stale) setLoadError(errorText(err, 'تعذّر قراءة المدفوع على الطلب.')); });
    return () => { stale = true; };
  }, [open, orderId, category]);

  // Switching the currency keeps the value: the extra in dollars becomes dinars at the rate
  const switchTo = (next: 'USD' | 'LYD' | null) => {
    if (!next || next === currency || !room) return;
    const r = Number(rate) || room.lyd?.rate || 0;
    const v = Number(amount) || 0;
    if (v > 0 && r > 0) setAmount(String(next === 'LYD' ? round2(v * r) : round2(v / r)));
    setCurrency(next);
  };

  const value = Number(amount) || 0;
  const rateValue = Number(rate) || 0;
  const usdValue = currency === 'USD' ? value : rateValue > 0 ? round2(value / rateValue) : 0;
  const reopened = room ? round2(usdValue - room.extraUsd) : 0;
  const problem = (() => {
    if (!room) return '';
    if (currency === 'LYD') {
      if (!(rateValue > 0)) return 'اكتب سعر الصرف.';
      if (room.lyd && rateValue > room.lyd.maximum + 1e-9) return `أعلى سعر مسموح ${room.lyd.maximum}: سعر أعلى يعطي دنانير أكثر من المبلغ.`;
    }
    if (value <= 0) return amount ? 'اكتب مبلغاً أكبر من صفر.' : '';
    if (usdValue > room.maxUsd + 1e-9) return `أقصى ما يُرجع $${money(room.maxUsd)}${currency === 'LYD' && rateValue > 0 ? ` (${money(room.maxUsd * rateValue)} د.ل)` : ''}.`;
    return '';
  })();
  const canSave = !!room && value > 0 && !problem && !!description.trim() && !saving;
  const shown = currency === 'USD' ? `$${money(value)}` : `${money(value)} د.ل`;

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      await sys.post(`acc/orders/${orderId}/payment-returns`, {
        category, currency, amount: value, ...(currency === 'LYD' && { rate: rateValue }), description: description.trim(), idempotencyKey: key.current,
      });
      onDone(`أُرجع ${shown} إلى محفظة العميل`);
      onClose();
    } catch (err: any) {
      setError(errorText(err));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth="xs" dir="rtl">
      <DialogTitle>{TITLES[category]}</DialogTitle>
      <DialogContent>
        <p className="op-muted" style={{ marginTop: 0 }}>يُضاف المبلغ لمحفظة العميل بسطر واحد في كشف حسابه، وتبقى الدفعة الأصلية كما هي.</p>
        {loadError && <Alert severity="error" className="mb-2">{loadError}</Alert>}
        {error && <Alert severity="error" className="mb-2">{error}</Alert>}
        {!room && !loadError && <CircularProgress size={20} />}
        {room && (
          <>
            {room.maxUsd <= 0 ? (
              <Alert severity="info" className="mb-2">لا يوجد مبلغ يمكن إرجاعه من {category === 'invoice' ? 'هذه الفاتورة' : 'الشحن'}.</Alert>
            ) : (
              <Alert severity={room.extraUsd > 0 ? 'success' : 'info'} className="mb-2">
                {room.extraUsd > 0 ? <>دفع العميل <b dir="ltr">${money(room.extraUsd)}</b> أكثر من المطلوب. </> : <>لم يدفع العميل أكثر من المطلوب. </>}
                أقصى ما يُرجع <b dir="ltr">${money(room.maxUsd)}</b>.
              </Alert>
            )}
            {room.pointsUsd > 0 && (
              <Alert severity="warning" className="mb-2">
                دفع <b dir="ltr">${money(room.pointsUsd)}</b> بالنقاط: لا تُرجع فلوساً. لإرجاعها ألغِ النقاط من قسم النقاط في هذه الصفحة.
              </Alert>
            )}
            <ToggleButtonGroup exclusive size="small" value={currency} onChange={(_, next) => switchTo(next)} disabled={saving || room.maxUsd <= 0} className="mb-2" aria-label="العملة">
              <ToggleButton value="USD">دولار</ToggleButton>
              <ToggleButton value="LYD" disabled={!room.lyd}>دينار</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              fullWidth className="mt-2" type="number" label="المبلغ" value={amount} disabled={saving || room.maxUsd <= 0}
              onChange={(e) => { setAmount(e.target.value); setError(''); }} onWheel={(e) => (e.target as HTMLInputElement).blur()}
              inputProps={{ min: 0, step: 'any', dir: 'ltr' }}
              InputProps={{ startAdornment: <InputAdornment position="start">{currency === 'USD' ? '$' : 'د.ل'}</InputAdornment> }}
              error={!!problem} helperText={problem || (currency === 'LYD' && usdValue > 0 ? `= $${money(usdValue)}` : ' ')}
            />
            {currency === 'LYD' && (
              <TextField
                fullWidth className="mt-2" type="number" label="سعر الصرف" value={rate} disabled={saving}
                onChange={(e) => { setRate(e.target.value); setError(''); }} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                inputProps={{ min: 0, step: 'any', dir: 'ltr' }}
                helperText={room.lyd ? `سعر المحاسب ${room.lyd.rate}، والأعلى ${room.lyd.maximum}` : ' '}
              />
            )}
            {value > 0 && !problem && reopened > 0.005 && (
              <Alert severity="warning" className="mb-2">
                المبلغ أكبر من الزائد بـ <b dir="ltr">${money(reopened)}</b>: يصبح هذا المبلغ مستحقاً على العميل في الفاتورة من جديد.
              </Alert>
            )}
            <TextField
              fullWidth className="mt-2" label="البيان (سبب الإرجاع)" value={description} disabled={saving || room.maxUsd <= 0} dir="auto"
              placeholder="مثلاً: نزل سعر الفاتورة من 200 إلى 180" onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 300 }}
              helperText="يظهر للعميل في كشف حسابه"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>تراجع</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>
          {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : value > 0 ? `أرجِع ${shown}` : 'أرجِع'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentReturnDialog;
