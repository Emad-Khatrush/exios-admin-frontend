import { ReactNode, useState } from 'react';
import { Autocomplete, FormControl, IconButton, InputLabel, MenuItem, Select, TextField, Tooltip } from '@mui/material';
import { BsCheck2 } from 'react-icons/bs';
import { MdDeleteOutline } from 'react-icons/md';
import { ORDER_KINDS, OrderKind, PackageStep } from './constants';

// Small building blocks of the order form. Each one reports changes the way the pages expect:
// handleChange({ target: { name, value, id? } }, checked?).

export const blurOnWheel = (event: any) => event.target.blur();
export const NUMBER_INPUT = { inputMode: 'numeric' as const, step: 'any', min: 0 };

export const Section = ({ title, hint, action, children }: { title: string, hint?: ReactNode, action?: ReactNode, children: ReactNode }) => (
  <section className="of-section">
    <header className="of-section__head">
      <div>
        <h3 className="of-section__title">{title}</h3>
        {hint && <p className="of-section__hint">{hint}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);

type Option = [value: string, label: string];

// A select with its label, for a fixed list of options
export const SelectField = ({ label, name, options, defaultValue, value, onChange, required, disabled, id }: {
  label: string, name: string, options: Option[], defaultValue?: any, value?: any, onChange: (event: any) => void, required?: boolean, disabled?: boolean, id?: string
}) => (
  <FormControl required={required} disabled={disabled}>
    <InputLabel>{label}</InputLabel>
    <Select
      label={label} name={name}
      {...(value !== undefined ? { value: value ?? '' } : { defaultValue: defaultValue ?? '' })}
      // The event of a select has no id; rows pass theirs so the page knows which one changed
      onChange={(event) => onChange(id === undefined ? event : { target: { name, value: event.target.value, id } })}
    >
      {options.map(([optionValue, optionLabel]) => <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>)}
    </Select>
  </FormControl>
);

const OTHER = 'غير';

// A searchable list that only accepts its own options. Choosing "غير" opens a text field for a
// place we do not list; a saved value that is not in the list shows up that way too.
export const ComboField = ({ label, name, options, defaultValue, onChange, required, disabled, helperText }: {
  label: string, name: string, options: string[], defaultValue?: string, onChange: (event: any) => void, required?: boolean, disabled?: boolean, helperText?: ReactNode
}) => {
  const initial = defaultValue || '';
  const isListed = options.includes(initial);
  const [choice, setChoice] = useState<string | null>(isListed ? initial : initial ? OTHER : null);
  const [custom, setCustom] = useState(isListed ? '' : initial);
  const report = (value: string) => onChange({ target: { name, value } });
  return (
    <div className="of-combo">
      <Autocomplete
        autoHighlight disableClearable={!!choice as any} options={[...options, OTHER]} disabled={disabled} value={choice as any}
        onChange={(_, next: any) => {
          setChoice(next);
          report(next === OTHER ? custom.trim() : next || '');
        }}
        renderInput={(params) => <TextField {...params} label={label} required={required} helperText={helperText} dir="auto" />}
      />
      {choice === OTHER && (
        <TextField
          label={`${label} (other)`} value={custom} required={required} disabled={disabled} dir="auto" autoFocus={!custom}
          onChange={(event) => {
            setCustom(event.target.value);
            report(event.target.value.trim());
          }}
        />
      )}
    </div>
  );
};

// A yes/no property of the order shown as a chip that is on or off
export const ToggleChip = ({ label, name, defaultChecked, onChange, disabled, tone = 'neutral' }: {
  label: string, name: string, defaultChecked?: boolean, onChange: (event: any, checked: boolean) => void, disabled?: boolean, tone?: 'neutral' | 'warn' | 'danger'
}) => (
  <label className={`of-chip of-chip--${tone}${disabled ? ' is-disabled' : ''}`}>
    <input type="checkbox" name={name} defaultChecked={!!defaultChecked} disabled={disabled} onChange={(event) => onChange(event, event.target.checked)} />
    <span className="of-chip__box"><BsCheck2 /></span>
    <span className="of-chip__label">{label}</span>
  </label>
);

// The journey of a package: one block per checkpoint, filled once it is reached. A click ticks
// or unticks a block.
export const Checkpoints = ({ steps, isDone, onToggle, disabled }: {
  steps: PackageStep[], isDone: (name: string) => boolean, onToggle: (name: string) => void, disabled?: boolean
}) => (
  <ol className={`of-track of-track--${steps.length}`}>
    {steps.map(({ name, label, hint, locked }, index) => {
      const done = isDone(name);
      const button = (
        <button type="button" disabled={disabled || !!locked} aria-pressed={done} onClick={() => onToggle(name)} title={locked ? undefined : done ? `Untick: ${label}` : `Mark as done: ${label}`}>
          <span className="of-track__mark">{done ? <BsCheck2 /> : index + 1}</span>
          <span className="of-track__text">
            <span className="of-track__label">{label}</span>
            <span className="of-track__hint">{hint}</span>
          </span>
        </button>
      );
      return (
        <li key={name} className={`${done ? 'is-done' : ''}${locked ? ' is-locked' : ''}`}>
          {locked ? <Tooltip arrow title={<span dir="rtl">{done ? locked.done : locked.open}</span>}><span className="of-track__locked">{button}</span></Tooltip> : button}
        </li>
      );
    })}
  </ol>
);

// What the order is, as three cards to choose from
export const OrderKindPicker = ({ value, onChange, disabled }: { value: OrderKind, onChange: (kind: OrderKind) => void, disabled?: boolean }) => (
  <div className="of-kinds" role="radiogroup" aria-label="Order type">
    {ORDER_KINDS.map((kind) => (
      <button
        key={kind.value} type="button" role="radio" aria-checked={value === kind.value} disabled={disabled}
        className={`of-kind${value === kind.value ? ' is-active' : ''}`} onClick={() => onChange(kind.value)}
      >
        <span className="of-kind__mark">{value === kind.value && <BsCheck2 />}</span>
        <span className="of-kind__text">
          <span className="of-kind__label">{kind.label}</span>
          <span className="of-kind__hint">{kind.hint}</span>
        </span>
      </button>
    ))}
  </div>
);

export const RemoveRowButton = ({ onClick, disabled, label }: { onClick: () => void, disabled?: boolean, label: string }) => (
  <Tooltip title={disabled ? '' : label}>
    <span>
      <IconButton type="button" size="small" color="error" aria-label={label} onClick={onClick} disabled={disabled}><MdDeleteOutline /></IconButton>
    </span>
  </Tooltip>
);

export const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Weight, unit and charge of a package, whichever shape the row has (a new order keeps weight
// and unit side by side; a saved one keeps them together)
export const packageFigures = (details: any = {}) => {
  const weight = typeof details.weight === 'object' && details.weight !== null ? details.weight.total : details.weight;
  const unit = (typeof details.weight === 'object' && details.weight?.measureUnit) || details.measureUnit || '';
  const price = Number(details.exiosPrice || 0);
  return { weight: Number(weight || 0), unit, price, charge: Number(weight || 0) * price };
};

// The fees charged on a package beside its shipping, each in its own currency, and what the
// package comes to: dollars (shipping + fees in dollars) plus dinars (fees in dinars)
export const PACKAGE_FEES = [{ field: 'domesticFee', label: 'Transport fee' }, { field: 'customsFee', label: 'Customs clearance' }];
export const packageFees = (details: any = {}) => PACKAGE_FEES
  .map(({ field, label }) => ({ label, amount: Number(details[field]?.amount || 0), currency: details[field]?.currency || 'LYD' }))
  .filter((fee) => fee.amount > 0);
export const packageTotal = (details: any = {}) => {
  const fees = packageFees(details);
  return {
    usd: packageFigures(details).charge + fees.filter((f) => f.currency === 'USD').reduce((sum, f) => sum + f.amount, 0),
    lyd: fees.filter((f) => f.currency === 'LYD').reduce((sum, f) => sum + f.amount, 0),
  };
};
export const formatLyd = (value: number) => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} LYD`;
// The packages of an order at a glance: shipping, each fee, and the total to collect
export const PackagesSummary = ({ paymentList }: { paymentList: any[] }) => {
  const rows = paymentList.map((payment) => payment?.deliveredPackages || {});
  const shipping = rows.reduce((sum, details) => sum + packageFigures(details).charge, 0);
  const fees = PACKAGE_FEES.map(({ field, label }) => {
    const all = rows.map((details) => details[field]).filter((fee) => Number(fee?.amount) > 0);
    return { label, usd: all.filter((f) => f.currency === 'USD').reduce((s, f) => s + Number(f.amount), 0), lyd: all.filter((f) => f.currency !== 'USD').reduce((s, f) => s + Number(f.amount), 0) };
  }).filter((fee) => fee.usd || fee.lyd);
  const total = rows.reduce((sum, details) => { const t = packageTotal(details); return { usd: sum.usd + t.usd, lyd: sum.lyd + t.lyd }; }, { usd: 0, lyd: 0 });
  return (
    <dl className="of-package__facts of-packages-summary">
      <div><dt>Shipping</dt><dd>{formatMoney(shipping)}</dd></div>
      {fees.map((fee) => <div key={fee.label}><dt>{fee.label}</dt><dd>{totalText(fee)}</dd></div>)}
      <div><dt>Total</dt><dd className="of-package__charge">{totalText(total)}</dd></div>
    </dl>
  );
};

export const totalText = ({ usd, lyd }: { usd: number, lyd: number }) => [usd || !lyd ? formatMoney(usd) : '', lyd ? formatLyd(lyd) : ''].filter(Boolean).join(' + ');
