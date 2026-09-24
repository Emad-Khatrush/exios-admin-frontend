import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, InputAdornment, Snackbar, Switch, TextField } from '@mui/material';
import { BadgePercent, Plane, Plus, Ship, Trash2 } from 'lucide-react';
import moment from 'moment';
import api from '../../api';
import {
  DEFAULT_CATEGORY_NAMES,
  MAX_CATEGORIES,
  MAX_CATEGORY_NAME_LENGTH,
  SpecialPrices,
  getCategories,
} from '../../utils/specialPrices';
import './SpecialPricesTab.scss';

type Props = {
  user: any
  onSaved?: (specialPrices: SpecialPrices) => void
}

// Local row with a stable key so React keeps focus while names are typed or rows removed
type CategoryRow = { key: number, name: string, air: string, sea: string };

let nextRowKey = 0;
const makeRow = (name = '', air?: number, sea?: number): CategoryRow => ({
  key: nextRowKey++,
  name,
  air: String(air ?? ''),
  sea: String(sea ?? ''),
});

// Customers without saved categories start with the defaults, which can then be renamed or deleted
const toRows = (prices?: SpecialPrices): CategoryRow[] => {
  const saved = getCategories(prices);
  if (saved.length === 0) return DEFAULT_CATEGORY_NAMES.map(name => makeRow(name));
  return saved.map(category => makeRow(category.name, category.air, category.sea));
};

const isInvalidPrice = (value: string) => value !== '' && !(Number(value) > 0);

const SpecialPricesTab = ({ user, onSaved }: Props) => {
  const isAdminOrAccountant = useSelector((state: any) => !!state.session?.account?.roles?.isAdmin || !!state.session?.account?.roles?.isAccountant);
  const saved: SpecialPrices | undefined = user?.specialPrices;

  const [enabled, setEnabled] = useState<boolean>(!!saved?.enabled);
  const [rows, setRows] = useState<CategoryRow[]>(() => toRows(saved));
  const [note, setNote] = useState<string>(saved?.note || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string }>();

  const readOnly = !isAdminOrAccountant || isSaving;

  const nameCounts = rows.reduce<Record<string, number>>((counts, row) => {
    const name = row.name.trim().toLowerCase();
    if (name) counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  const nameError = (row: CategoryRow) => {
    const name = row.name.trim();
    if (!name) return 'Name needed';
    if (nameCounts[name.toLowerCase()] > 1) return 'Used twice';
    return '';
  };

  const hasInvalidPrice = rows.some(row => isInvalidPrice(row.air) || isInvalidPrice(row.sea));
  const hasNameError = rows.some(row => !!nameError(row));
  const hasAnyPrice = rows.some(row => row.air !== '' || row.sea !== '');
  const cannotSave = isSaving || hasInvalidPrice || hasNameError || (enabled && !hasAnyPrice);

  const updateRow = (key: number, field: 'name' | 'air' | 'sea', value: string) => {
    setRows(prev => prev.map(row => (row.key === key ? { ...row, [field]: value } : row)));
  };

  const addRow = () => setRows(prev => [...prev, makeRow()]);

  const removeRow = (key: number) => setRows(prev => prev.filter(row => row.key !== key));

  const save = async () => {
    try {
      setIsSaving(true);
      const categories = rows.map(row => ({ name: row.name.trim(), air: row.air, sea: row.sea }));
      const res = await api.update(`customer/${user._id}/specialPrices`, { enabled, note, categories });
      onSaved?.(res.data.specialPrices);
      setMessage({ type: 'success', text: 'Special prices saved' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Could not save the special prices' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="special-prices-tab">
      <header className="spt-header">
        <div className="spt-heading">
          <span className="spt-icon"><BadgePercent size={18} strokeWidth={2} /></span>
          <div>
            <h3>Special prices</h3>
            <p>Custom Exios prices for {user?.firstName} {user?.lastName}. Staff pick them with one click in shipment invoices.</p>
          </div>
        </div>
        <label className="spt-toggle">
          <Switch checked={enabled} onChange={(_, checked) => setEnabled(checked)} disabled={readOnly} />
          {enabled ? 'Active' : 'Off'}
        </label>
      </header>

      <div className={`spt-grid${enabled ? '' : ' is-off'}`}>
        <div className="spt-grid-head">
          <span>Category</span>
          <span><Plane size={14} strokeWidth={2} /> Air, per KG</span>
          <span><Ship size={14} strokeWidth={2} /> Sea, per CBM</span>
          <span aria-hidden="true" />
        </div>

        {rows.length === 0 && (
          <p className="spt-no-rows">No categories. Add one to set a special price.</p>
        )}

        {rows.map(row => {
          const rowNameError = nameError(row);
          return (
            <div key={row.key} className="spt-row">
              <TextField
                size="small"
                aria-label="Category name"
                placeholder="Category name"
                value={row.name}
                onChange={event => updateRow(row.key, 'name', event.target.value)}
                error={!!rowNameError}
                helperText={rowNameError || undefined}
                disabled={readOnly}
                inputProps={{ maxLength: MAX_CATEGORY_NAME_LENGTH }}
              />
              {(['air', 'sea'] as const).map(mode => (
                <TextField
                  key={mode}
                  size="small"
                  type="number"
                  aria-label={`${row.name || 'Category'} ${mode} price`}
                  placeholder={mode === 'air' ? 'Air, per KG' : 'Sea, per CBM'}
                  value={row[mode]}
                  onChange={event => updateRow(row.key, mode, event.target.value)}
                  onWheel={(event: any) => event.target.blur()}
                  error={isInvalidPrice(row[mode])}
                  disabled={readOnly}
                  inputProps={{ inputMode: 'decimal', step: 0.01, min: 0 }}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                />
              ))}
              <button
                type="button"
                className="spt-remove"
                aria-label={`Delete ${row.name || 'category'}`}
                title="Delete category"
                onClick={() => removeRow(row.key)}
                disabled={readOnly}
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          );
        })}

        {isAdminOrAccountant && (
          <button
            type="button"
            className="spt-add"
            onClick={addRow}
            disabled={readOnly || rows.length >= MAX_CATEGORIES}
          >
            <Plus size={16} strokeWidth={2} /> Add category
          </button>
        )}
      </div>

      {hasInvalidPrice && <p className="spt-error">Prices must be more than 0. Leave a box empty if there is no special price.</p>}
      {enabled && !hasAnyPrice && <p className="spt-error">Add at least one price to turn special prices on.</p>}

      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Note (optional)"
        placeholder="Why this customer has special prices"
        value={note}
        onChange={event => setNote(event.target.value)}
        disabled={readOnly}
        className="spt-note"
      />

      <footer className="spt-footer">
        <span className="spt-meta">
          {saved?.updatedAt ? `Last changed ${moment(saved.updatedAt).format('DD/MM/YYYY HH:mm')}` : 'Never set'}
        </span>
        {isAdminOrAccountant && (
          <button type="button" className="spt-save" onClick={save} disabled={cannotSave}>
            {isSaving ? 'Saving...' : 'Save prices'}
          </button>
        )}
      </footer>

      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage(undefined)}>
        <Alert severity={message?.type} onClose={() => setMessage(undefined)} sx={{ width: '100%' }}>
          {message?.text}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default SpecialPricesTab;
