import { useMemo, useState } from 'react';
import { Autocomplete, Tab, Tabs, TextField } from '@mui/material';
import { activityMessageTemplates, formatActivityMessage } from '../../containers/EditInvoice/orderConstants';

const groups = Array.from(new Set(activityMessageTemplates.map(item => item.group)));
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
type Props = { value: string; onChange: (value: string) => void; disabled?: boolean; id?: string; initialGroup?: string; order?: any };

export default function ActivityMessagePicker({ value, onChange, disabled, id = 'activity-message', initialGroup = 'الوصول', order }: Props) {
  const [category, setCategory] = useState(groups.includes(initialGroup) ? initialGroup : groups[0]);
  const [search, setSearch] = useState('');
  const options = useMemo(() => activityMessageTemplates.filter(item => item.group === category).map(item => order ? formatActivityMessage(item.text, order) : item.text), [category, order]);
  return <div dir="rtl" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
    <Tabs value={category} onChange={(_, next) => { setCategory(next); setSearch(''); }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
      aria-label="قسم التحديث" sx={{ minHeight: 38, '& .MuiTab-root': { minHeight: 38, minWidth: 'auto', px: 1.5, fontSize: 12, textTransform: 'none' } }}>
      {groups.map(group => <Tab key={group} value={group} label={group} disabled={disabled} />)}
      <Tab value="custom" label="رسالة خاصة" disabled={disabled} />
    </Tabs>
    {category !== 'custom' && <Autocomplete
      options={options} value={null} inputValue={search} disabled={disabled} openOnFocus blurOnSelect
      onInputChange={(_, next, reason) => { if (reason === 'input' || reason === 'clear') setSearch(next); }}
      onChange={(_, next) => { if (next) { onChange(next); setSearch(''); } }}
      filterOptions={(items, state) => { const terms = normalize(state.inputValue).trim().split(/\s+/).filter(Boolean); return items.filter(item => terms.every(term => normalize(item).includes(term))); }}
      noOptionsText="لا توجد رسالة مطابقة؛ غيّر البحث أو اكتب رسالتك أدناه."
      openText="عرض الرسائل" closeText="إغلاق القائمة" clearText="مسح البحث"
      ListboxProps={{ style: { direction: 'rtl', textAlign: 'right', maxHeight: 280 } }}
      renderInput={params => <TextField {...params} size="small" label="اختر رسالة" placeholder="اختر من القائمة أو ابحث…" />}
    />}
    <TextField id={id} label="نص التحديث" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} multiline minRows={2} maxRows={6} required fullWidth size="small" inputProps={{ dir: 'auto' }} placeholder="اكتب التحديث هنا" helperText={!order && (value.includes('[بلد الشحن]') || value.includes('[اسم العميل]')) ? 'يُملأ الاسم وبلد الشحن حسب كل طلبية. يمكنك تعديل بقية النص.' : 'يمكنك تعديل الرسالة قبل إضافتها.'} />
  </div>;
}
