import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Count, isBeforeCount } from '../../utils/useCountDay';
import { Ltr } from './ui';

// A statement line whose money moved before the opening count: the counted balance already holds it,
// so the line is closed with no entry. A line the bank or partner recorded after the count day asks
// for the day the money really moved (it must be on or before the count).
export const coverableLine = (count: Count | null, line: any) => !!count && line?.lineStatus === 'unmatched'
  && (isBeforeCount(count, line.day) || (Date.parse(line.day) - Date.parse(count.day)) / 86400000 <= 31);

export default function CoverBeforeCount({ line, count, amount, busy, onCancel, onSubmit }: {
  line: any; count: Count; amount: React.ReactNode; busy?: boolean;
  onCancel: () => void; onSubmit: (input: { note: string; happenedOn?: string }) => void;
}) {
  const late = !isBeforeCount(count, line.day);
  const [happenedOn, setHappenedOn] = useState(late ? count.day : '');
  const [note, setNote] = useState('');
  const dayError = !late ? '' : !happenedOn ? 'اكتب تاريخ العملية الفعلي'
    : !isBeforeCount(count, happenedOn) ? `يجب أن يكون في يوم الجرد (${count.day}) أو قبله`
      : happenedOn > line.day ? 'لا يكون بعد تاريخها في الكشف' : '';
  return <Stack gap={2}>
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f7fafc', border: '1px solid #dbe6ee' }}>
      <Typography fontWeight={700} fontSize={18}>{amount}</Typography>
      <Typography fontSize={13} color="text.secondary" sx={{ mt: .5 }}><Ltr>{line.day}</Ltr> · {line.description}</Typography>
    </Box>
    <Alert severity="info" icon={false} sx={{ lineHeight: 1.9 }}>
      يُغلق السطر <b>بدون قيد</b>: رصيد الجرد يوم <Ltr>{count.day}</Ltr> يشمل هذا المال.
      {late && <> تاريخه في الكشف بعد الجرد، فاكتب اليوم الذي حصلت فيه العملية فعلًا.</>}
    </Alert>
    {late && <TextField type="date" size="small" fullWidth label="تاريخ العملية الفعلي" InputLabelProps={{ shrink: true }}
      value={happenedOn} onChange={(e) => setHappenedOn(e.target.value)} error={!!dayError} helperText={dayError || 'اليوم الذي خرج فيه المال أو دخل فعلًا'} />}
    <TextField size="small" fullWidth multiline minRows={2} label="ما كانت هذه العملية" placeholder="مثال: سداد وصل من خزينة طرابلس"
      value={note} onChange={(e) => setNote(e.target.value)} />
    <Stack direction="row" justifyContent="flex-end" gap={1}>
      <Button disabled={busy} onClick={onCancel}>إلغاء</Button>
      <Button variant="contained" disableElevation disabled={busy || !!dayError || !note.trim()}
        onClick={() => onSubmit({ note: note.trim(), happenedOn: late ? happenedOn : undefined })}>إغلاق بدون قيد</Button>
    </Stack>
  </Stack>;
}
