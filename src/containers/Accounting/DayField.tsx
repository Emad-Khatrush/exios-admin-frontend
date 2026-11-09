import { useEffect, useRef, useState } from 'react';
import { IconButton, InputAdornment, TextField, TextFieldProps } from '@mui/material';
import { CalendarDays } from 'lucide-react';

// A day, always read and typed as YYYY-MM-DD (owner's request 2026-11-10). The browser's own date
// box prints a day in the computer's language (02/10/2026: the 10th of February on one machine,
// the 2nd of October on another) while every list and report here prints 2026-02-10, so a day
// was typed a month off and its payment fell outside the week in which statement lines are
// matched. This box takes the place of <TextField type="date">: same value ('YYYY-MM-DD' or ''),
// same onChange (event.target.value), and the calendar is still one click away.

const real = (day: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return false;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const made = new Date(Date.UTC(year, month - 1, date));
  return year >= 1900 && made.getUTCFullYear() === year && made.getUTCMonth() === month - 1 && made.getUTCDate() === date;
};
// Digits as they are typed, with the dashes put in: 20260210 → 2026-02-10
export const shapeDay = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');
};

export default function DayField({ value, onChange, inputProps, InputProps, InputLabelProps, disabled, error, onBlur, ...rest }: TextFieldProps) {
  const day = typeof value === 'string' ? value : '';
  const [text, setText] = useState(day);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(day); }, [day]);
  const { min, max, ...textProps } = (inputProps || {}) as any;
  const send = (next: string) => { if (next !== day) (onChange as any)?.({ target: { value: next } }); };
  // The day reaches the form once it is whole and real; half a day typed changes nothing yet
  const type = (raw: string) => {
    const next = shapeDay(raw);
    setText(next);
    if (next === '' || real(next)) send(next);
  };
  const unfinished = text !== '' && !real(text);
  const outside = real(text) && ((!!min && text < min) || (!!max && text > max));
  return (
    <TextField {...rest} disabled={disabled} value={text} error={!!error || unfinished || outside} placeholder="YYYY-MM-DD"
      onChange={(event) => type(event.target.value)}
      // A day left half typed goes back to the one the form holds, so what is shown is what is saved
      onBlur={(event) => { if (unfinished) setText(day); onBlur?.(event); }}
      InputLabelProps={{ shrink: true, ...InputLabelProps }}
      inputProps={{ inputMode: 'numeric', maxLength: 10, autoComplete: 'off', ...textProps, style: { direction: 'ltr', textAlign: 'right', ...(textProps.style || {}) } }}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" edge="end" tabIndex={-1} aria-label="اختيار التاريخ من التقويم" disabled={disabled}
              onClick={() => { const box = picker.current as any; if (box?.showPicker) box.showPicker(); else box?.click(); }}>
              <CalendarDays size={16} />
            </IconButton>
            <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" value={real(day) ? day : ''} min={min} max={max}
              onChange={(event) => { if (event.target.value) { setText(event.target.value); send(event.target.value); } }}
              style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0, pointerEvents: 'none' }} />
          </InputAdornment>
        ),
      }} />
  );
}
