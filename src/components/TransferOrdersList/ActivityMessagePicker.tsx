import { useMemo, useState } from 'react';
import { Autocomplete, MenuItem, TextField } from '@mui/material';
import { activityMessageGroup, activityMessageTemplates } from '../../containers/EditInvoice/orderConstants';

const groups = Array.from(new Set(activityMessageTemplates.map(item => item.group)));
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
type Props = { value: string; onChange: (value: string) => void; disabled?: boolean; id?: string };

export default function ActivityMessagePicker({ value, onChange, disabled, id = 'activity-message' }: Props) {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const options = useMemo(() => activityMessageTemplates.filter(item => category === 'all' || item.group === category).map(item => item.text), [category]);
  return <div dir="rtl" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
    <TextField select size="small" label="تصنيف الرسالة" value={category} disabled={disabled} onChange={event => { setCategory(event.target.value); setSearch(''); }} fullWidth SelectProps={{ MenuProps: { PaperProps: { dir: 'rtl' } } }}>
      <MenuItem value="all">كل التصنيفات ({activityMessageTemplates.length})</MenuItem>
      {groups.map(group => <MenuItem key={group} value={group}>{group} ({activityMessageTemplates.filter(item => item.group === group).length})</MenuItem>)}
      <MenuItem value="custom">كتابة رسالة مخصصة</MenuItem>
    </TextField>
    {category !== 'custom' && <Autocomplete
      options={options} value={null} inputValue={search} disabled={disabled} openOnFocus blurOnSelect
      groupBy={activityMessageGroup}
      onInputChange={(_, next, reason) => { if (reason === 'input' || reason === 'clear') setSearch(next); }}
      onChange={(_, next) => { if (next) { onChange(next); setSearch(''); } }}
      filterOptions={(items, state) => { const terms = normalize(state.inputValue).trim().split(/\s+/).filter(Boolean); return items.filter(item => terms.every(term => normalize(item).includes(term))); }}
      noOptionsText="لا توجد رسالة مطابقة؛ غيّر البحث أو اكتب رسالتك أدناه."
      openText="عرض الرسائل" closeText="إغلاق القائمة" clearText="مسح البحث"
      ListboxProps={{ style: { direction: 'rtl', textAlign: 'right', maxHeight: 280 } }}
      renderInput={params => <TextField {...params} size="small" label="ابحث واختر رسالة" placeholder="مثال: تخليص، بنغازي، استلام…" helperText={`${options.length} رسالة متاحة${category === 'all' ? ' في كل التصنيفات' : ` ضمن ${category}`}`} />}
    />}
    <TextField id={id} label="نص التحديث" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} multiline minRows={3} maxRows={8} required fullWidth size="small" inputProps={{ dir: 'auto' }} placeholder="اختر رسالة من القائمة أو اكتب نصًا مخصصًا هنا" helperText="هذا النص هو الذي سيظهر للعميل. يمكنك تعديله؛ تغيير التصنيف أو البحث لا يمسح النص المكتوب." />
  </div>;
}
