import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField } from '@mui/material';

export const MATCH_ENGINES = [
  { id: 'ledger', label: 'القيود المسجلة في الدفاتر', detail: 'ربط الحركة بقيد موجود دون إنشاء قيد جديد.' },
  { id: 'purchases', label: 'فواتير الموردين وتكاليف الطلبيات والرحلات', detail: 'اقتراح التكلفة الموجودة لمراجعتها وسدادها دون تكرارها.' },
  { id: 'classification', label: 'قواعد التصنيف والموردون المعروفون', detail: 'اقتراح الحساب المقابل من قواعد الكلمات وهوية المورد ونوع الحركة.' },
  { id: 'history', label: 'التعلم من المطابقات السابقة', detail: 'استخدام التصنيف الذي اعتمدته سابقًا لنفس البيان.' },
  { id: 'partners', label: 'إيداعات المحافظ وحوالات الحسابات الجارية', detail: 'اقتراح العمليات المسجلة لدى شركات الخدمات.' },
  { id: 'yuan', label: 'شراء اليوان وعمليات Alipay', detail: 'اقتراح شراء اليوان المسجل والعمليات المرتبطة به.' },
];
export type MatchingSettings = { engines: string[], proposalDays: number, automaticDays: number, requireIdentity: boolean };
export const defaultMatchingSettings = (): MatchingSettings => ({ engines: MATCH_ENGINES.map(e => e.id), proposalDays: 7, automaticDays: 3, requireIdentity: false });
export function readMatchingSettings(accountId: string): MatchingSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(`acc-bank-matching:${accountId}`) || 'null');
    if (!saved || !Array.isArray(saved.engines)) return defaultMatchingSettings();
    return { engines: saved.engines.filter((id: string) => MATCH_ENGINES.some(e => e.id === id)),
      proposalDays: [0, 1, 3, 7].includes(saved.proposalDays) ? saved.proposalDays : 7,
      automaticDays: [0, 1, 3].includes(saved.automaticDays) ? saved.automaticDays : 3, requireIdentity: saved.requireIdentity === true };
  } catch { return defaultMatchingSettings(); }
}
export default function BankMatchingSettings({ value, accountName, onChange, onClose, onSave }: {
  value: MatchingSettings, accountName: string, onChange: (value: MatchingSettings) => void, onClose: () => void, onSave: () => void,
}) {
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm" dir="rtl">
    <DialogTitle>إعدادات المطابقة — {accountName}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <Alert severity="info">اختر أكثر من طريقة. تُحفظ الإعدادات لهذا الحساب على هذا الجهاز، وتُطبّق على الاقتراحات والكشوف الجديدة. المطابقات المعتمدة سابقًا تبقى كما هي.</Alert>
      <Stack direction="row" spacing={1}>
        <Button onClick={() => onChange(defaultMatchingSettings())}>استعادة الافتراضي</Button>
        <Button onClick={() => onChange({ ...value, engines: [] })}>إلغاء اختيار الطرق</Button>
      </Stack>
      {MATCH_ENGINES.map(engine => <div key={engine.id}>
        <FormControlLabel label={engine.label} control={<Checkbox checked={value.engines.includes(engine.id)} onChange={(_, checked) => onChange({ ...value, engines: checked ? [...value.engines, engine.id] : value.engines.filter(id => id !== engine.id) })} />}/>
        <div style={{ fontSize: 12, color: '#64748b', paddingInlineStart: 32 }}>{engine.detail}</div>
      </div>)}
      <TextField select label="أقصى فرق تاريخ لاقتراح الفاتورة أو الطلبية" value={value.proposalDays} onChange={e => onChange({ ...value, proposalDays: Number(e.target.value) })}>
        {[0, 1, 3, 7].map(days => <MenuItem key={days} value={days}>{days === 0 ? 'نفس اليوم فقط' : `${days} أيام`}</MenuItem>)}
      </TextField>
      <TextField select disabled={!value.engines.includes('ledger')} label="أقصى فرق تاريخ للمطابقة التلقائية مع قيد موجود" value={value.automaticDays} onChange={e => onChange({ ...value, automaticDays: Number(e.target.value) })}>
        {[0, 1, 3].map(days => <MenuItem key={days} value={days}>{days === 0 ? 'نفس اليوم فقط' : `${days} أيام`}</MenuItem>)}
      </TextField>
      <FormControlLabel label="اقتراح الفواتير فقط عند تطابق اسم المورد أو مرجع العملية" control={<Checkbox checked={value.requireIdentity} onChange={(_, checked) => onChange({ ...value, requireIdentity: checked })} />}/>
      <Alert severity="warning">المطابقة التلقائية تشترط تطابق المبلغ والعملة وقيدًا واحدًا واضحًا فقط. الفواتير والتكاليف والاقتراحات القريبة تحتاج مراجعتك. فحص التكرار يبقى فعّالًا مع جميع الإعدادات.</Alert>
      {!value.engines.length && <Alert severity="info">كل طرق الاقتراح معطلة؛ يمكنك اختيار المطابقة يدويًا.</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>إلغاء</Button><Button variant="contained" onClick={onSave}>حفظ وتحديث الاقتراحات</Button></DialogActions>
  </Dialog>;
}
