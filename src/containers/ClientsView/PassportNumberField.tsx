import { TextField } from '@mui/material';
import { PassportVerification } from '../../models';

type Props = {
  value: string
  onChange: (value: string) => void
  passport?: PassportVerification
  disabled?: boolean
}

// The passport number to approve with: what the customer confirmed at sign-up (or empty for older
// accounts), editable against the photo. Required and unique on the server. When the customer
// changed what was read from the photo, the read number is shown so staff can compare.
const PassportNumberField = ({ value, onChange, passport, disabled }: Props) => {
  const read = passport?.numberRead;
  const changed = !!read && read !== value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (
    <div className="passport-number-field">
      <TextField
        size="small"
        label="Passport number"
        required
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        inputProps={{ dir: 'ltr', maxLength: 14, style: { letterSpacing: '0.08em', fontWeight: 700 } }}
        helperText={
          !passport?.number ? 'Not given at sign-up: type it from the photo before approving.'
            : passport.numberSource === 'read' ? 'Read from the photo and confirmed by the customer. Check it against the photo.'
              : 'Typed by the customer. Check it against the photo.'
        }
      />
      {changed && <p className="pvt-meta">The photo read: <strong dir="ltr">{read}</strong></p>}
    </div>
  );
};

export default PassportNumberField;
