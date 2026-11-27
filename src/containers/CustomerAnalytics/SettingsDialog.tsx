import { useEffect, useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, TextField,
} from '@mui/material';
import { Plus, X } from 'lucide-react';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { TARGETS, Unit } from './compare';
import { count, usdWhole } from './format';
import { Num } from './shared';
import { Company, CompanySuggestion, Settings, Targets } from './types';

// The form shows rates as %, money as $ and the rest as typed; the API keeps rates 0..1 and money in cents
const toForm = (unit: Unit, v?: number | null) => {
  if (v == null) return '';
  if (unit === 'rate') return String(Math.round(v * 1000) / 10);
  if (unit === 'money') return String(Math.round(v) / 100);
  return String(v);
};
const fromForm = (unit: Unit, text: string): number | null => {
  const n = Number(text.trim());
  if (!text.trim() || !Number.isFinite(n)) return null;
  if (unit === 'rate') return n / 100;
  if (unit === 'money') return Math.round(n * 100);
  return n;
};
const SUFFIX: Partial<Record<Unit, string>> = { rate: '%', days: 'يوم', count: 'عميل', rating: 'من 5', ratio: '×' };

type Found = { id: string, name: string, customerId: string | null }

// «الأهداف» and the company accounts (GET/PUT analytics/customers-settings). Saving clears the API's
// cache; `onSaved` reloads the open section.
const SettingsDialog = ({ open, onClose, onSaved }: { open: boolean, onClose: () => void, onSaved: () => void }) => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suggest, setSuggest] = useState<CompanySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setFound(null);
    setSearch('');
    Promise.all([
      api.get('analytics/customers-settings'),
      api.get('analytics/customers/companies-suggest').catch(() => ({ data: { rows: [] } })),
    ]).then(([settings, sug]: any[]) => {
      const s: Settings = settings.data || { targets: {}, companies: [] };
      setForm(Object.fromEntries(TARGETS.map((t) => [t.key, toForm(t.unit, s.targets?.[t.key])])));
      setCompanies(s.companies || []);
      setSuggest(sug.data?.rows || []);
    }).catch((e) => setError(requestError(e, 'تعذّر تحميل الإعدادات.')))
      .finally(() => setLoading(false));
  }, [open]);

  const marked = new Set(companies.map((c) => c.id));
  const add = (c: Found) => { if (!marked.has(c.id)) setCompanies([...companies, { id: c.id, name: c.name, customerId: c.customerId }]); };
  const remove = (id: string) => setCompanies(companies.filter((c) => c.id !== id));

  // The clients list of the admin (GET clients?searchValue=) finds by code, name or phone
  const find = async () => {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await api.get('clients', { searchValue: q, limit: 8, skip: 0 });
      setFound((res.data?.results || []).map((u: any) => ({
        id: String(u._id), name: `${u.firstName || ''} ${u.lastName || ''}`.trim(), customerId: u.customerId || null,
      })));
    } catch {
      // No access to the clients list: a 24-character id can still be added as it is
      setFound(/^[a-f0-9]{24}$/i.test(q) ? [{ id: q, name: q, customerId: null }] : []);
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    const targets: Targets = {};
    TARGETS.forEach((t) => { targets[t.key] = fromForm(t.unit, form[t.key] || ''); });
    setSaving(true);
    setError('');
    try {
      await api.update('analytics/customers-settings', { targets, companies: companies.map((c) => c.id) });
      onSaved();
      onClose();
    } catch (e) {
      setError(requestError(e, 'تعذّر الحفظ. أعد المحاولة.'));
    } finally {
      setSaving(false);
    }
  };

  const bad = TARGETS.filter((t) => (form[t.key] || '').trim() && fromForm(t.unit, form[t.key]) == null);
  const freshSuggest = suggest.filter((s) => !marked.has(s.id));

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md" dir="rtl">
      <DialogTitle>الأهداف وحسابات الشركات</DialogTitle>
      <DialogContent className="ca-dialog">
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? <div className="ca-dialog__wait"><CircularProgress size={28} /></div> : (
          <>
            <h3 className="ca-dialog__h">الأهداف</h3>
            <p className="ca-muted">يظهر الهدف تحت الرقم في كل قسم مع ✓ إذا تحقق. اترك الخانة فارغة لإلغاء الهدف.</p>
            <div className="ca-targets">
              {TARGETS.map((t) => (
                <TextField
                  key={t.key} size="small" label={t.label} helperText={`${t.where} · ${t.better === 'up' ? 'الأعلى أفضل' : 'الأقل أفضل'}`}
                  value={form[t.key] || ''} onChange={(e) => setForm({ ...form, [t.key]: e.target.value })}
                  error={bad.includes(t)} inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
                  InputProps={{
                    startAdornment: t.unit === 'money' ? <InputAdornment position="start">$</InputAdornment> : undefined,
                    endAdornment: SUFFIX[t.unit] ? <InputAdornment position="end">{SUFFIX[t.unit]}</InputAdornment> : undefined,
                  }}
                />
              ))}
            </div>

            <h3 className="ca-dialog__h">حسابات الشركات</h3>
            <p className="ca-muted">حسابات تطلب لشركات أو تجار كبار، فتغيّر المتوسطات. يمكن استثناؤها من كل الأقسام بمفتاح «استثناء حسابات الشركات».</p>
            {!companies.length ? <p className="ca-empty">لا توجد حسابات شركات بعد.</p> : (
              <ul className="ca-chips">
                {companies.map((c) => (
                  <li key={c.id}>
                    <span>{c.name || 'بدون اسم'}{c.customerId ? <> · <Num>{c.customerId}</Num></> : null}</span>
                    <IconButton size="small" aria-label={`إزالة ${c.name}`} onClick={() => remove(c.id)}><X size={14} /></IconButton>
                  </li>
                ))}
              </ul>
            )}

            <div className="ca-find">
              <TextField
                size="small" label="ابحث بكود العميل أو الاسم أو الهاتف" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } }} sx={{ flex: '1 1 240px' }}
              />
              <Button variant="outlined" onClick={find} disabled={!search.trim() || searching}>{searching ? 'جارٍ البحث…' : 'بحث'}</Button>
            </div>
            {found && (!found.length ? <p className="ca-muted">لا نتائج.</p> : (
              <ul className="ca-pick">
                {found.map((f) => (
                  <li key={f.id}>
                    <span>{f.name || 'بدون اسم'}{f.customerId ? <> · <Num>{f.customerId}</Num></> : null}</span>
                    <Button size="small" startIcon={<Plus size={14} />} onClick={() => add(f)} disabled={marked.has(f.id)}>{marked.has(f.id) ? 'مضاف' : 'شركة'}</Button>
                  </li>
                ))}
              </ul>
            ))}

            {freshSuggest.length > 0 && (
              <>
                <h4 className="ca-dialog__h4">اقتراحات: أكثر العملاء طلبات</h4>
                <ul className="ca-pick">
                  {freshSuggest.map((s) => (
                    <li key={s.id}>
                      <span>{s.name || 'بدون اسم'}{s.customerId ? <> · <Num>{s.customerId}</Num></> : null}</span>
                      <small className="ca-muted"><Num>{count(s.orders)}</Num> طلب · <Num>{usdWhole(s.valueCents)}</Num></small>
                      <Button size="small" startIcon={<Plus size={14} />} onClick={() => add(s)}>شركة</Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button variant="contained" onClick={save} disabled={loading || saving || bad.length > 0}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;
