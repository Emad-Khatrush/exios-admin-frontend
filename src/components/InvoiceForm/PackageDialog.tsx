import { ReactNode, useRef } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, Switch, TextField } from '@mui/material';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import { MdClose } from 'react-icons/md';
import ImageUploader from '../ImageUploader/ImageUploader';
import SpecialPricePicker from '../SpecialPricePicker/SpecialPricePicker';
import { SpecialPrices, getShippingMode } from '../../utils/specialPrices';
import { SHIPMENT_METHODS, toDate, unitForMethod } from './constants';
import { NUMBER_INPUT, SelectField, blurOnWheel, formatMoney } from './parts';

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
}

export const CLOSED_PACKAGE: PackageDraft = {
  open: false, id: 0, trackingNumber: '', shipmentMethod: '', locationPlace: '', packageWeight: '', measureUnit: '', exiosPrice: '',
  boxesCount: '', arrivedAt: null, visableForClient: true, images: [],
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
const NUMERIC = ['packageWeight', 'exiosPrice', 'boxesCount'];

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
            <TextField label="Weight" type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} value={value.packageWeight ?? ''} onChange={text('packageWeight')} disabled={disabled} />
            <SelectField label="Unit" name="measureUnit" options={UNITS} value={value.measureUnit} onChange={(event) => set({ measureUnit: event.target.value })} disabled={disabled} />
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
          <div className="of-charge">
            <span>Shipping charge for the customer</span>
            <strong>{value.packageWeight || 0} {value.measureUnit} x {formatMoney(Number(value.exiosPrice || 0))} = {formatMoney(charge)}</strong>
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
