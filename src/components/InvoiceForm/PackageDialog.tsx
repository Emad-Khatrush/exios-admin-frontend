import { ReactNode, useRef } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Switch, TextField } from '@mui/material';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import { MdClose } from 'react-icons/md';
import ImageUploader from '../ImageUploader/ImageUploader';
import SpecialPricePicker from '../SpecialPricePicker/SpecialPricePicker';
import { SpecialPrices, getShippingMode } from '../../utils/specialPrices';
import { SHIPMENT_METHODS, toDate, unitForMethod } from './constants';
import { NUMBER_INPUT, SelectField, blurOnWheel, formatMoney } from './parts';
import { cbmOf, usePackageSettings } from '../../utils/usePackageSettings';

export type Volumetric = { enabled?: boolean, cbm?: any, length?: any, width?: any, height?: any };
export type DomesticFee = { amount?: any, currency?: string };

export type PackageDraft = {
  open: boolean
  // Row index in the order's packages, and the saved package's id (absent on a new row)
  id: number
  _id?: string
  trackingNumber: string
  shipmentMethod: string
  locationPlace: string
  packageWeight: number | string
  measureUnit: string
  exiosPrice: number | string
  boxesCount: number | string
  arrivedAt: any
  visableForClient: boolean
  images: any[]
  // Charged by volume (spec v8): packageWeight is then the volumetric weight and the scale's
  // weight is actualWeight
  volumetric: Volumetric
  actualWeight: number | string
  // Transport to another office, charged beside the shipping
  domesticFee: DomesticFee
  // The package was saved with a weight: only an admin or the accountant changes its measures
  savedWithWeight?: boolean
}

export const CLOSED_PACKAGE: PackageDraft = {
  open: false, id: 0, trackingNumber: '', shipmentMethod: '', locationPlace: '', packageWeight: '', measureUnit: '', exiosPrice: '',
  boxesCount: '', arrivedAt: null, visableForClient: true, images: [], volumetric: {}, actualWeight: '', domesticFee: {}, savedWithWeight: false,
};

type Props = {
  value: PackageDraft
  onChange: (next: PackageDraft) => void
  onClose: () => void
  // The page's change handler; every field reports to it with the row index as its id
  handleChange: any
  specialPrices?: SpecialPrices
  disabled?: boolean
  onUploadFiles?: (event: any) => Promise<any[]>
  onDeleteFile?: (file: any, packageId: string) => Promise<any[]>
}

const UNITS: [string, string][] = [['KG', 'KG'], ['CBM', 'CBM']];
const NUMERIC = ['packageWeight', 'exiosPrice', 'boxesCount', 'actualWeight'];

// Reports one field of a package row to the page
export const reportPackageField = (handleChange: any, row: number | string, name: string, value: any) => (
  handleChange({ target: { id: String(row), name, value, ...(NUMERIC.includes(name) ? { inputMode: 'numeric' } : {}) } }, undefined, undefined, name)
);

// A plain titled block. Not a <fieldset>: the admin's global stylesheet draws a border on those.
const Group = ({ title, children }: { title: string, children: ReactNode }) => (
  <div className="of-group" role="group" aria-label={title}>
    <h4 className="of-group__title">{title}</h4>
    {children}
  </div>
);

// Everything about one package of the order: what it is, what it weighs and costs, where it is
const PackageDialog = ({ value, onChange, onClose, handleChange, specialPrices, disabled, onUploadFiles, onDeleteFile }: Props) => {
  const filesRef = useRef();
  const { volumetricFactor, canEditMeasures } = usePackageSettings();
  // A saved weight or volume: only an admin, the accountant or the owner changes it
  const measuresLocked = disabled || (!!value.savedWithWeight && !canEditMeasures);

  // Shows the changes here and reports each one to the page under the package's row
  const set = (patch: Partial<PackageDraft>) => {
    onChange({ ...value, ...patch });
    Object.entries(patch).forEach(([name, next]) => reportPackageField(handleChange, value.id, name, next));
  };
  const text = (name: keyof PackageDraft) => (event: any) => set({ [name]: event.target.value });

  // Air is weighed in KG and sea is measured in CBM, so the unit follows the method
  const changeMethod = (method: string) => set({ shipmentMethod: method, ...(unitForMethod(method) ? { measureUnit: unitForMethod(method) } : {}) });

  const charge = Number(value.packageWeight || 0) * Number(value.exiosPrice || 0);
  const unit = value.measureUnit || 'unit';
  const volumetric = value.volumetric || {};
  const byVolume = !!volumetric.enabled && unit !== 'CBM';
  const cbm = cbmOf(volumetric);
  const fee = value.domesticFee || {};

  // The volumetric weight follows the volume; the server works it out again on save
  const setVolume = (patch: Volumetric) => {
    const next = { ...volumetric, ...patch };
    const nextCbm = cbmOf(next);
    set({ volumetric: next, ...(next.enabled && nextCbm > 0 ? { packageWeight: Math.round(nextCbm * volumetricFactor * 100) / 100 } : {}) });
  };
  const toggleVolume = (enabled: boolean) => {
    if (enabled) {
      const nextCbm = cbmOf(volumetric);
      set({ volumetric: { ...volumetric, enabled }, actualWeight: value.actualWeight || value.packageWeight, ...(nextCbm > 0 ? { packageWeight: Math.round(nextCbm * volumetricFactor * 100) / 100 } : {}) });
    } else {
      set({ volumetric: { ...volumetric, enabled }, packageWeight: value.actualWeight || value.packageWeight });
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={value.open} onClose={onClose}>
      <DialogTitle className="of-dialog__title">
        <div>
          Package {value.id + 1}
          {value.trackingNumber && <span className="of-dialog__sub">{value.trackingNumber}</span>}
        </div>
        <IconButton aria-label="Close" onClick={onClose} size="small"><MdClose /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Group title="Package">
          <div className="of-grid of-grid--3">
            <TextField label="Tracking number" value={value.trackingNumber || ''} onChange={text('trackingNumber')} disabled={disabled} autoFocus />
            <SelectField label="Shipment method" name="shipmentMethod" options={SHIPMENT_METHODS} value={value.shipmentMethod} onChange={(event) => changeMethod(event.target.value)} disabled={disabled} />
            <TextField label="Boxes count" type="number" inputProps={{ ...NUMBER_INPUT, step: 1 }} onWheel={blurOnWheel} value={value.boxesCount ?? ''} onChange={text('boxesCount')} disabled={disabled} />
          </div>
        </Group>

        <Group title="Weight and price">
          <div className="of-grid of-grid--3">
            {byVolume
              ? <TextField label="Actual weight (scale)" type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={value.actualWeight ?? ''} onChange={text('actualWeight')} disabled={measuresLocked} helperText={`Charged on ${value.packageWeight || 0} KG (volumetric)`} />
              : <TextField label="Weight" type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={value.packageWeight ?? ''} onChange={text('packageWeight')} disabled={measuresLocked} />}
            <SelectField label="Unit" name="measureUnit" options={UNITS} value={value.measureUnit} onChange={(event) => set({ measureUnit: event.target.value })} disabled={measuresLocked} />
            <TextField
              label={`Exios price per ${unit}`} type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={value.exiosPrice ?? ''} onChange={text('exiosPrice')} disabled={disabled}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </div>
          <SpecialPricePicker
            prices={specialPrices}
            mode={getShippingMode(value.measureUnit, value.shipmentMethod)}
            selected={value.exiosPrice}
            onPick={(price: number) => set({ exiosPrice: price })}
            disabled={disabled}
          />
          {unit !== 'CBM' && (
            <FormControlLabel
              className="of-switch"
              label={`Charge by volumetric weight (CBM x ${volumetricFactor})`}
              control={<Checkbox checked={!!volumetric.enabled} onChange={(event) => toggleVolume(event.target.checked)} disabled={measuresLocked} />}
            />
          )}
          {byVolume && (
            <div className="of-grid of-grid--3">
              <TextField label="Volume (CBM)" type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={volumetric.cbm ?? ''} onChange={(event) => setVolume({ cbm: event.target.value })} disabled={measuresLocked}
                helperText={!Number(volumetric.cbm) && cbm > 0 ? `${cbm.toFixed(4)} CBM from the dimensions` : 'Or type the dimensions'} />
              <TextField label="Volumetric weight (KG)" value={cbm > 0 ? (Math.round(cbm * volumetricFactor * 100) / 100) : ''} disabled />
              <span />
              {(['length', 'width', 'height'] as const).map((side) => (
                <TextField key={side} label={`${side[0].toUpperCase()}${side.slice(1)} (cm)`} type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={volumetric[side] ?? ''}
                  onChange={(event) => setVolume({ [side]: event.target.value, cbm: '' })} disabled={measuresLocked} />
              ))}
            </div>
          )}
          {measuresLocked && !disabled && <Alert severity="info" className="mt-2">The weight and volume are saved. Only an admin or the accountant can change them.</Alert>}
          <div className="of-charge">
            <span>Shipping charge for the customer{byVolume ? ' (volumetric)' : ''}</span>
            <strong>{value.packageWeight || 0} {value.measureUnit} x {formatMoney(Number(value.exiosPrice || 0))} = {formatMoney(charge)}</strong>
          </div>
        </Group>

        <Group title="Transport to another office (optional)">
          <div className="of-grid of-grid--3">
            <TextField label="Transport fee" type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={fee.amount ?? ''} onChange={(event) => set({ domesticFee: { currency: fee.currency || 'LYD', amount: event.target.value } })} disabled={disabled}
              helperText="Charged on this package beside its shipping, when the office sends it on" />
            <TextField select label="Currency" value={fee.currency || 'LYD'} onChange={(event) => set({ domesticFee: { amount: fee.amount, currency: event.target.value } })} disabled={disabled}>
              <MenuItem value="LYD">LYD</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
            </TextField>
          </div>
        </Group>

        <Group title="Where it is">
          <div className="of-grid of-grid--2">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Arrived at origin warehouse" inputFormat="dd/MM/yyyy" value={toDate(value.arrivedAt)} disabled={disabled}
                renderInput={(params: any) => <TextField {...params} helperText="Our warehouse abroad (China, UAE, Turkey), not Libya" />}
                onChange={(date) => set({ arrivedAt: date })}
              />
            </LocalizationProvider>
            <TextField label="Placed at" value={value.locationPlace || ''} onChange={text('locationPlace')} disabled={disabled} helperText="Shelf or spot where the package is kept" />
          </div>
          <FormControlLabel
            className="of-switch"
            label="The customer can see this package"
            control={<Switch checked={value.visableForClient !== false} onChange={(event) => set({ visableForClient: event.target.checked })} disabled={disabled} />}
          />
        </Group>

        <Group title="Files">
          {value._id && onUploadFiles ? (
            <ImageUploader
              id={value._id}
              inputFileRef={filesRef}
              fileUploaderHandler={async (event: any) => onChange({ ...value, images: await onUploadFiles(event) })}
              previewFiles={value.images || []}
              deleteImage={onDeleteFile ? async (file: any) => onChange({ ...value, images: await onDeleteFile(file, value._id!) }) : undefined}
            />
          ) : (
            <p className="of-empty">Files can be attached after the package is saved. Press Done, save the invoice, then open the package again.</p>
          )}
        </Group>
      </DialogContent>

      <DialogActions>
        <span className="of-dialog__hint">Changes are kept with the form and stored when you save the invoice.</span>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PackageDialog;
