import React from 'react';

export type ChoiceOption = { value: string, label: string }

export const COUNTRY_OPTIONS: ChoiceOption[] = [
  { value: 'CN', label: 'China' },
  { value: 'UAE', label: 'UAE' },
  { value: 'TR', label: 'Turkey' },
  { value: 'USA', label: 'USA' },
  { value: 'UK', label: 'UK' },
  // Goods already in Libya: office warehouses and internal shipping (شحن داخلي)
  { value: 'LY', label: 'Libya' },
];

export const SHIPPING_TYPE_OPTIONS: ChoiceOption[] = [
  { value: 'air', label: 'جوي' },
  { value: 'sea', label: 'بحري' },
  { value: 'domestic', label: 'شحن داخلي' },
];

export const SEA_LOAD_OPTIONS: ChoiceOption[] = [
  { value: '', label: 'غير محدد' },
  { value: 'FCL', label: 'FCL — حاوية كاملة' },
  { value: 'LCL', label: 'LCL — شحن مجمّع' },
];

export const OFFICE_OPTIONS: ChoiceOption[] = [
  { value: 'tripoli', label: 'Tripoli' },
  { value: 'benghazi', label: 'Benghazi' },
];

export const STATUS_OPTIONS: ChoiceOption[] = [
  { value: 'processing', label: 'لم تكتمل بعد' },
  { value: 'finished', label: 'اكتملت' },
];

// The two dates of a voyage, named so they can't be mixed up
export const ARRIVAL_DATE_LABEL = 'Arrival date (تاريخ الوصول)';
export const ARRIVAL_DATE_HINT = 'The day the shipment arrived in Libya.';
export const READY_DATE_LABEL = 'Ready date (تاريخ الجرد والجاهزية)';
export const READY_DATE_HINT = 'The day the inventory was finished and the goods were ready for customers. Filled in automatically when the status is set to اكتملت.';
export const READY_DATE_AUTO_HINT = 'Left empty for now. It is filled in automatically with the date you set the status to اكتملت.';

export const optionLabel = (options: ChoiceOption[], value?: string) =>
  options.find(option => option.value === String(value))?.label || value || '';

type ChoiceGroupProps = {
  name: string
  label: string
  options: ChoiceOption[]
  value?: string
  onChange: (event: { target: { name: string, value: string } }) => void
  required?: boolean
  disabled?: boolean
  hint?: string
}

// A row of buttons that behaves like a radio group. Native radios keep keyboard use and
// the browser's "required" check working.
export const ChoiceGroup = ({ name, label, options, value, onChange, required, disabled, hint }: ChoiceGroupProps) => (
  <div className="inv-field">
    <span className="inv-label" id={`${name}-label`}>
      {label}{required && <em aria-hidden="true">*</em>}
    </span>
    <div className="inv-choice" role="radiogroup" aria-labelledby={`${name}-label`}>
      {options.map(option => {
        const checked = String(value ?? '') === option.value;
        return (
          <label key={option.value} className={checked ? 'is-checked' : undefined}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              required={required}
              disabled={disabled}
              onChange={() => onChange({ target: { name, value: option.value } })}
            />
            {option.label}
          </label>
        );
      })}
    </div>
    {hint && <span className="inv-hint">{hint}</span>}
  </div>
);

export const FieldLabel = ({ children, required, note }: { children: React.ReactNode, required?: boolean, note?: string }) => (
  <span className="inv-label">
    {children}{required && <em aria-hidden="true">*</em>}
    {note && <small>{note}</small>}
  </span>
);
