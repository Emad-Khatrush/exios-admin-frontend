import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import { CircularProgress, TextField } from "@mui/material";
import ImageUploader from "../../components/ImageUploader/ImageUploader";
import React, { useRef, useState } from "react";
import { useSelector } from 'react-redux';
import InventoryAttachments, { FileVisibility } from '../../components/InventoryAttachments/InventoryAttachments';
import api from "../../api";
import { getErrorMessage } from "../../utils/errorHandler";
import { newTripCreationRequestId, useTripNumbering } from '../../utils/useTripNumbering';
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { ARRIVAL_DATE_HINT, ARRIVAL_DATE_LABEL, ChoiceGroup, COUNTRY_OPTIONS, FieldLabel, OFFICE_OPTIONS, READY_DATE_AUTO_HINT, READY_DATE_LABEL, SHIPPING_TYPE_OPTIONS, SEA_LOAD_OPTIONS } from "./InventoryFields";

import './InventoryForm.scss';

const AddInventory = () => {

  const history = useNavigate();

  // No ready date on create: it is set when the inventory is marked finished (اكتملت)
  const [form, setForm] = useState<any>({});
  const numbering = useTripNumbering(form.shippedCountry, form.shippingType, form.seaLoadType);
  const requestId = useRef('');
  if (!requestId.current) requestId.current = newTripCreationRequestId();
  const submitting = useRef(false);

  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [files, setFiles] = useState<any>([]);
  const [defaultVisibility, setDefaultVisibility] = useState<FileVisibility>('staff');
  const roles = useSelector((state: any) => state.session.account?.roles);
  const canManageFiles = !!(roles?.isAdmin || roles?.isAccountant);

  const filesRef = React.createRef();

  const fileUploaderHandler = (event: any) => {
    const selected = Array.from<File>(event.target.files || []);
    if (selected.some(file => file.size > 25 * 1024 * 1024) || files.length + selected.length > 20) {
      setError('Choose up to 20 files, with each file 25 MB or smaller.'); return;
    }
    const pending = selected.map(file => Object.assign(file, { visibility: canManageFiles ? defaultVisibility : 'staff' }));
    setFiles((previous: any[]) => [...previous, ...pending]);
    if (event.target.value !== undefined) event.target.value = '';
  };
  const deleteImage = (file: any) => setFiles((previous: any[]) => previous.filter(item => item !== file));
  const changePendingVisibility = (file: any, visibility: FileVisibility) => {
    setFiles((previous: any[]) => previous.map(item => item === file ? Object.assign(item, { visibility }) : item));
  };

  const onChangeHandler = (event: any) => {
    const { name, value } = event.target;
    setForm((previous: any) => ({ ...previous, [name]: value, ...(name === 'shippingType' && value !== 'sea' ? { seaLoadType: '' } : {}) }));
  }

  const onSubmit = (event: any) => {
    event.preventDefault();

    if (!form || submitting.current || !numbering.ready) {
      return;
    }

    const formData  = new FormData();
    for (const data in form) {
      // A cleared date is null; sending it would arrive as the text "null"
      if (form[data] !== undefined && form[data] !== null && form[data] !== '') {
        formData.append(data, form[data] instanceof Date ? form[data].toISOString() : form[data]);
      }
    }

    if (files) {
      files.forEach((file: any) => {
        formData.append('files', file);
      });
    }

    formData.append('attachmentVisibilities', JSON.stringify(files.map((file: any) => file.visibility || 'staff')));
    formData.append('inventoryType', 'inventoryGoods');
    formData.append('creationRequestId', requestId.current);

    submitting.current = true;
    setIsLoading(true);
    setError(undefined);

    api.fetchFormData(`inventory`, 'POST', formData)
      .then((res: any) => {
        if (res?.success !== undefined && !res?.success) {
          setError(getErrorMessage(res.message));
          setIsLoading(false);
          submitting.current = false;
        } else {
          history(`/inventory/${res._id}/edit`);
        }
      })
      .catch((error) => {
        setError(getErrorMessage(error.message));
        setIsLoading(false);
        submitting.current = false;
      })
  }

  return (
    <div className="inv-page">
      <Link className="inv-back" to="/inventory">
        <ChevronLeft size={16} strokeWidth={2} />
        Inventory
      </Link>

      <header className="inv-head">
        <div>
          <h1>New inventory</h1>
          <p className="inv-head-meta">Create the voyage first. You can add packages and expenses after saving.</p>
        </div>
      </header>

      <form className="inv-form" onSubmit={onSubmit}>
        {error &&
          <div className="inv-error" role="alert">{error}</div>
        }

        <section className="inv-card">
          <div className="inv-card-head">
            <h2>Voyage</h2>
          </div>

          <div className="inv-grid">
            <div className="inv-voyage-row is-wide">
            <div className="inv-field">
              <FieldLabel required>{numbering.enabled ? 'Trip name — automatic numbering' : 'Voyage number'}</FieldLabel>
              <TextField
                size="small"
                fullWidth
                name="voyage"
                required={!numbering.enabled}
                value={numbering.enabled ? numbering.voyage : form.voyage || ''}
                disabled={numbering.loading || numbering.enabled || isLoading}
                onChange={onChangeHandler}
                inputProps={{ 'aria-label': 'Voyage number', dir: 'auto' }}
              />
              <span className="inv-hint">{numbering.loading ? 'Loading the next trip number…' : numbering.enabled ? 'The final number is reserved on save and may advance if another trip is created first.' : !form.shippedCountry || !form.shippingType ? 'Select a country and shipping type to load numbering settings.' : form.shippingType === 'sea' && !form.seaLoadType ? 'Select FCL or LCL to load numbering settings.' : 'Automatic numbering is off for this type. Enter the name manually.'}</span>
              {numbering.error && <div className="inv-error" role="alert">{numbering.error} <button type="button" className="inv-btn is-ghost" onClick={numbering.retry}>Retry</button></div>}
            </div>

            <div>
              <ChoiceGroup
                name="shippedCountry"
                label="Shipped from"
                options={COUNTRY_OPTIONS}
                value={form.shippedCountry}
                onChange={onChangeHandler}
                required
              />
            </div>
            </div>

            <ChoiceGroup
              name="shippingType"
              label="Shipping type"
              options={SHIPPING_TYPE_OPTIONS}
              value={form.shippingType}
              onChange={onChangeHandler}
              required
            />

            {form.shippingType === 'sea' && <ChoiceGroup name="seaLoadType" label="نوع الشحن البحري" options={SEA_LOAD_OPTIONS} value={form.seaLoadType || ''} onChange={onChangeHandler} required />}

            <ChoiceGroup
              name="inventoryPlace"
              label="Inventory office"
              options={OFFICE_OPTIONS}
              value={form.inventoryPlace}
              onChange={onChangeHandler}
              required
            />
          </div>
        </section>

        <section className="inv-card">
          <div className="inv-card-head">
            <h2>Dates</h2>
          </div>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
          <div className="inv-grid">
            <div className="inv-field">
              <FieldLabel note="Optional">{ARRIVAL_DATE_LABEL}</FieldLabel>
              <DatePicker
                inputFormat="dd/MM/yyyy"
                value={form?.arrivalDate || null}
                renderInput={(params: any) => <TextField {...params} size="small" fullWidth />}
                onChange={(value) => onChangeHandler({ target: { name: 'arrivalDate', value } })}
              />
              <span className="inv-hint">{ARRIVAL_DATE_HINT}</span>
            </div>

            <div className="inv-field">
              <FieldLabel>{READY_DATE_LABEL}</FieldLabel>
              <span className="inv-hint">{READY_DATE_AUTO_HINT}</span>
            </div>
          </div>
          </LocalizationProvider>
        </section>

        <section className="inv-card">
          <div className="inv-card-head">
            <h2>Notes and files</h2>
          </div>

          <div className="inv-grid">
            <div className="inv-field is-wide">
              <FieldLabel note="Optional">Description</FieldLabel>
              <TextField
                fullWidth
                multiline
                minRows={3}
                name="note"
                onChange={onChangeHandler}
                inputProps={{ dir: 'auto', 'aria-label': 'Description' }}
              />
            </div>

            <div className="inv-field is-wide">
              <FieldLabel note="Optional">Attachments</FieldLabel>
              <ImageUploader
                id={'attachments'}
                inputFileRef={filesRef}
                fileUploaderHandler={fileUploaderHandler}
                previewFiles={[]}
                files={files}
                deleteImage={deleteImage}
                disabled={isLoading}
                inventoryFileAccess={{ value: defaultVisibility, onChange: setDefaultVisibility, canManage: canManageFiles }}
                previewContent={<InventoryAttachments files={files} pending canManage={canManageFiles} disabled={isLoading} onVisibilityChange={changePendingVisibility} onDelete={deleteImage} />}
              />
            </div>
          </div>
        </section>

        <div className="inv-actionbar">
          <span>Fields marked * are required</span>
          <div>
            <Link className="inv-btn is-ghost" to="/inventory">Cancel</Link>
            <button type="submit" className="inv-btn is-primary" disabled={isLoading || !numbering.ready}>
              {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Create inventory'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddInventory;
