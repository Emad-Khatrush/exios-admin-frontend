import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import { Alert, AlertColor, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, TextField } from "@mui/material";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DatePicker from "@mui/lab/DatePicker";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import ImageUploader from "../../components/ImageUploader/ImageUploader";
import FilesPreviewers from "../../components/FilesPreviewers/FilesPreviewers";
import React from "react";
import moment from "moment";
import { Inventory } from "../../models";
import InventoryOrders from "./InventoryOrders";
import { useSelector } from "react-redux";
import InventoryExpenses from "./InventoryExpenses";
import { TripAccounting } from "../Accounting/AccountingPanels";
import { convertGoogleStorageUrl } from "../../utils/methods";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import {
  ChoiceGroup,
  COUNTRY_OPTIONS,
  ARRIVAL_DATE_HINT,
  ARRIVAL_DATE_LABEL,
  FieldLabel,
  OFFICE_OPTIONS,
  optionLabel,
  READY_DATE_HINT,
  READY_DATE_LABEL,
  SHIPPING_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "./InventoryFields";

import './InventoryForm.scss';

const formatDate = (value?: string | Date) => (value ? moment(value).format('DD/MM/YYYY') : '');

const EditInventory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles, customerId } = useSelector((state: any) => state.session.account);
  const isAdmin = !!roles.isAdmin;

  const [inventory, setInventory] = useState<Inventory | any>();
  // The page opens as a summary; "Edit" switches to the form
  const [isEditing, setIsEditing] = useState(false);
  // Only the fields changed since the last save; sent as-is to the API
  const [form, setForm] = useState<Inventory | any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const [alert, setAlert] = useState({
    tint: 'success',
    message: ''
  });
  const [ filesInput, setFilesInput ] = useState<any>([]);
  const [ previewFiles, setPreviewFiles ] = useState<any>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const filesRef = React.createRef();

  useEffect(() => {
    getInventory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fileUploaderHandler = async (event: any) => {
    const files = event.target.files;

    let allFiles: any = [];
    const newFiles: any =[];

    for (const file of files) {
      newFiles.unshift(file)
    }

    // upload it in the cloudinary
    const data = new FormData()
    if (newFiles) {
      newFiles.forEach((file: any) => {
        data.append('files', file);
      });
    }
    data.append('id', String(id));
    await api.fetchFormData('inventory/uploadFiles', 'POST', data)

    allFiles = [
      ...filesInput,
      ...newFiles
    ]

    setFilesInput(allFiles);
  }

  const deleteImage = async (file: any) => {
    const fileIndex = previewFiles.indexOf(file);
    const deletedFile = filesInput[fileIndex];

    try {
      setIsLoading(true);
      await api.delete('inventory/deleteFiles', { image: deletedFile, id });
      setFilesInput((prev: any) => prev.filter((_: any, index: number) => index !== fileIndex));
      setPreviewFiles((prev: any) => prev.filter((_: any, index: number) => index !== fileIndex));
      setAlert({ tint: 'success', message: 'File deleted' });
    } catch (error: any) {
      setAlert({ tint: 'error', message: error?.response?.data?.message || 'Could not delete the file' });
    } finally {
      setIsLoading(false);
    }
  }

  const getInventory = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`inventory/${id}`);
      setInventory(res.data);
      setPreviewFiles(res.data.attachments.map((img: any) => convertGoogleStorageUrl(img.path) ));
      setFilesInput(res.data.attachments);
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Could not load this inventory');
    } finally {
      setIsLoading(false);
    }
  }

  const onChangeHandler = (event: any) => {
    const { name, value } = event.target;
    setForm((prevForm: any) => {
      const next = { ...prevForm, [name]: value };

      if (name === 'inventoryFinishedDate') {
        // Picked by hand: never overwrite it automatically
        delete next.readyDateIsAuto;
      }

      if (name === 'status') {
        const becameFinished = value === 'finished' && inventory?.status !== 'finished';
        const pickedByHand = 'inventoryFinishedDate' in prevForm && !prevForm.readyDateIsAuto;
        if (becameFinished && !pickedByHand) {
          // The ready date is the day the inventory is marked اكتملت
          next.inventoryFinishedDate = new Date();
          next.readyDateIsAuto = true;
        } else if (value !== 'finished' && prevForm.readyDateIsAuto) {
          // Switched back before saving: drop the automatic date again
          delete next.inventoryFinishedDate;
          delete next.readyDateIsAuto;
        }
      }
      return next;
    });
  }

  // Current value of a field: the unsaved edit if there is one, otherwise what is saved
  const valueOf = (name: string) => (name in form ? form[name] : inventory?.[name]);

  const isDirty = Object.keys(form).length > 0;

  const startEditing = () => {
    setForm({});
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cancelEditing = () => {
    setForm({});
    setIsEditing(false);
  }

  const onSubmit = async (event: any) => {
    event.preventDefault();
    if (!isDirty) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      // readyDateIsAuto only tracks the automatic ready date on this screen
      const { readyDateIsAuto, ...changes } = form;
      await api.update(`inventory?id=${inventory._id}`, changes);
      setInventory((prev: any) => ({ ...prev, ...changes }));
      setForm({});
      setIsEditing(false);
      setAlert({
        tint: 'success',
        message: 'Changes saved'
      })
    } catch (error: any) {
      console.log(error);
      setAlert({
        tint: 'error',
        message: error?.response?.data?.message || 'Could not save the changes'
      })
    } finally {
      setIsSaving(false);
    }
  }

  const deleteInventory = async () => {
    try {
      setIsDeleting(true);
      await api.delete(`inventory/${id}`, {});
      navigate('/inventory');
    } catch (error: any) {
      setShowDeleteConfirm(false);
      setAlert({
        tint: 'error',
        message: error?.response?.data?.message || 'Could not delete this inventory'
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (!inventory) {
    return (
      <div className="inv-page">
        {isLoading || !error ?
          <div className="inv-skeleton" aria-busy="true" aria-label="Loading inventory">
            <i className="is-short" />
            <i />
            <i />
          </div>
          :
          <div className="inv-error" role="alert">{error}</div>
        }
      </div>
    )
  }

  const orders = inventory?.orders || [];
  const deliveredCount = orders.filter((order: any) => order?.paymentList?.status?.received).length;
  const isFinished = inventory?.status === 'finished';

  return (
    <div className="inv-page">
      <Link className="inv-back" to="/inventory">
        <ChevronLeft size={16} strokeWidth={2} />
        Inventory
      </Link>

      <header className="inv-head">
        <div>
          <h1>
            {inventory?.voyage}
            <span className={`inv-badge ${isFinished ? 'is-ok' : 'is-warn'}`}>{optionLabel(STATUS_OPTIONS, inventory?.status || 'processing')}</span>
          </h1>
          <p className="inv-head-meta">
            {[
              optionLabel(COUNTRY_OPTIONS, inventory?.shippedCountry),
              optionLabel(SHIPPING_TYPE_OPTIONS, inventory?.shippingType),
              optionLabel(OFFICE_OPTIONS, inventory?.inventoryPlace),
            ].filter(Boolean).join(', ')}
          </p>
        </div>
        {!isEditing && (
          <div className="inv-head-actions">
            {isAdmin && (
              <button type="button" className="inv-btn is-danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={15} strokeWidth={2} />
                Delete
              </button>
            )}
            <button type="button" className="inv-btn is-primary" onClick={startEditing}>
              <Pencil size={15} strokeWidth={2} />
              Edit
            </button>
          </div>
        )}
      </header>

      {!isEditing ? (
        <>
          <section className="inv-tiles" aria-label="Summary">
            <div className="inv-tile">
              <span>Packages</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="inv-tile">
              <span>Delivered to customers</span>
              <strong>{deliveredCount}<small>of {orders.length}</small></strong>
            </div>
            <div className="inv-tile">
              <span>Ready date</span>
              <strong>{formatDate(inventory?.inventoryFinishedDate) || <small>Not set</small>}</strong>
            </div>
          </section>

          <section className="inv-card">
            <div className="inv-card-head">
              <h2>Voyage details</h2>
            </div>

            <dl className="inv-details">
              <div>
                <dt>Voyage number</dt>
                <dd>{inventory?.voyage}</dd>
              </div>
              <div>
                <dt>Shipped from</dt>
                <dd>{optionLabel(COUNTRY_OPTIONS, inventory?.shippedCountry) || <span className="is-empty">Not set</span>}</dd>
              </div>
              <div>
                <dt>Shipping type</dt>
                <dd>{optionLabel(SHIPPING_TYPE_OPTIONS, inventory?.shippingType) || <span className="is-empty">Not set</span>}</dd>
              </div>
              <div>
                <dt>Inventory office</dt>
                <dd>{optionLabel(OFFICE_OPTIONS, inventory?.inventoryPlace) || <span className="is-empty">Not set</span>}</dd>
              </div>
              <div>
                <dt>{ARRIVAL_DATE_LABEL}</dt>
                <dd>{formatDate(inventory?.arrivalDate) || <span className="is-empty">Not set</span>}</dd>
              </div>
              <div>
                <dt>{READY_DATE_LABEL}</dt>
                <dd>{formatDate(inventory?.inventoryFinishedDate) || <span className="is-empty">Not set</span>}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{optionLabel(STATUS_OPTIONS, inventory?.status || 'processing')}</dd>
              </div>
              <div>
                <dt>Odo reference code</dt>
                <dd>{inventory?.odoReferenceCode || <span className="is-empty">Not set</span>}</dd>
              </div>
              <div className="is-wide">
                <dt>Description</dt>
                <dd dir="auto" className="is-text">{inventory?.note || <span className="is-empty">No description</span>}</dd>
              </div>
              <div className="is-wide">
                <dt>Attachments</dt>
                <dd>
                  {previewFiles.length > 0 ?
                    <FilesPreviewers previewFiles={filesInput} files={previewFiles} />
                    :
                    <span className="is-empty">No files</span>
                  }
                </dd>
              </div>
            </dl>
          </section>
        </>
      ) : (
        <form className="inv-form" onSubmit={onSubmit}>
          <section className="inv-card">
            <div className="inv-card-head">
              <div>
                <h2>Voyage</h2>
                {!isAdmin && <p>Only admins can change the voyage details.</p>}
              </div>
            </div>

            <div className="inv-grid">
              <div className="inv-field">
                <FieldLabel required>Voyage number</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  name="voyage"
                  required
                  value={valueOf('voyage') ?? ''}
                  onChange={onChangeHandler}
                  disabled={!isAdmin}
                  inputProps={{ 'aria-label': 'Voyage number' }}
                />
              </div>

              <div className="inv-field">
                <FieldLabel note="Optional">Odo reference code</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  name="odoReferenceCode"
                  value={valueOf('odoReferenceCode') ?? ''}
                  onChange={onChangeHandler}
                  inputProps={{ 'aria-label': 'Odo reference code' }}
                />
              </div>


              <div className="is-wide">
                <ChoiceGroup
                  name="shippedCountry"
                  label="Shipped from"
                  options={COUNTRY_OPTIONS}
                  value={valueOf('shippedCountry')}
                  onChange={onChangeHandler}
                  disabled={!isAdmin}
                  required
                />
              </div>

              <ChoiceGroup
                name="shippingType"
                label="Shipping type"
                options={SHIPPING_TYPE_OPTIONS}
                value={valueOf('shippingType')}
                onChange={onChangeHandler}
                disabled={!isAdmin}
                required
              />

              <ChoiceGroup
                name="inventoryPlace"
                label="Inventory office"
                options={OFFICE_OPTIONS}
                value={valueOf('inventoryPlace')}
                onChange={onChangeHandler}
                disabled={!isAdmin}
                required
              />
            </div>
          </section>

          <section className="inv-card">
            <div className="inv-card-head">
              <h2>Dates and status</h2>
            </div>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <div className="inv-grid">
                <div className="inv-field">
                  <FieldLabel>{ARRIVAL_DATE_LABEL}</FieldLabel>
                  <DatePicker
                    inputFormat="dd/MM/yyyy"
                    value={valueOf('arrivalDate') || null}
                    renderInput={(params: any) => <TextField {...params} size="small" fullWidth />}
                    onChange={(value) => onChangeHandler({ target: { name: 'arrivalDate', value } })}
                  />
                  <span className="inv-hint">{ARRIVAL_DATE_HINT}</span>
                </div>

                <div className="inv-field">
                  <FieldLabel>{READY_DATE_LABEL}</FieldLabel>
                  <DatePicker
                    inputFormat="dd/MM/yyyy"
                    value={valueOf('inventoryFinishedDate') || null}
                    renderInput={(params: any) => <TextField {...params} size="small" fullWidth />}
                    onChange={(value) => onChangeHandler({ target: { name: 'inventoryFinishedDate', value } })}
                  />
                  <span className="inv-hint">{READY_DATE_HINT}</span>
                </div>

                <ChoiceGroup
                  name="status"
                  label="Inventory status"
                  options={STATUS_OPTIONS}
                  value={valueOf('status')}
                  onChange={onChangeHandler}
                />
              </div>
            </LocalizationProvider>
          </section>

          <section className="inv-card">
            <div className="inv-card-head">
              <div>
                <h2>Notes and files</h2>
                <p>Files upload as soon as you pick them.</p>
              </div>
            </div>

            <div className="inv-grid">
              <div className="inv-field is-wide">
                <FieldLabel note="Optional">Description</FieldLabel>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  name="note"
                  value={valueOf('note') ?? ''}
                  onChange={onChangeHandler}
                  inputProps={{ dir: 'auto', 'aria-label': 'Description' }}
                />
              </div>

              <div className="inv-field is-wide">
                <FieldLabel>Attachments</FieldLabel>
                <ImageUploader
                  id={'attachments'}
                  inputFileRef={filesRef}
                  previewFiles={previewFiles}
                  fileUploaderHandler={fileUploaderHandler}
                  files={filesInput}
                  deleteImage={(roles.isAdmin || roles.isAccountant) ? deleteImage : undefined}
                />
              </div>
            </div>
          </section>

          <div className="inv-actionbar" role="region" aria-label="Editing">
            <span>{isDirty ? 'You have unsaved changes' : 'Editing inventory'}</span>
            <div>
              <button type="button" className="inv-btn is-ghost" onClick={cancelEditing} disabled={isSaving}>Cancel</button>
              <button type="submit" className="inv-btn is-primary" disabled={isSaving || !isDirty}>
                {isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      )}

      {!isEditing && (roles.isAdmin || ['S092', 'A647'].includes(customerId)) && (
        <InventoryExpenses
          inventoryId={inventory?._id}
          inventory={inventory}
        />
      )}

      {!isEditing && <TripAccounting tripId={inventory?._id} />}

      {!isEditing && (
        <>
          <h2 className="inv-section-title">Packages</h2>
          <InventoryOrders
            inventory={inventory}
            getInventory={getInventory}
          />
        </>
      )}

      <Snackbar
        open={!!alert.message}
        autoHideDuration={2500}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setAlert({ tint: 'success', message: ''})}
      >
        <Alert
          severity={alert.tint as AlertColor}
          variant="filled"
          onClose={() => setAlert({ tint: 'success', message: ''})}
        >
          {alert.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this inventory?</DialogTitle>
        <DialogContent sx={{ fontSize: '0.9rem', color: '#5b6673' }}>
          This permanently deletes the inventory record for voyage <strong>{inventory?.voyage}</strong>.
          Orders already linked to it are not deleted, they just stop showing up under this voyage.
          This can't be undone.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button type="button" className="inv-btn is-ghost" disabled={isDeleting} onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </button>
          <button type="button" className="inv-btn is-danger-solid" disabled={isDeleting} onClick={deleteInventory}>
            {isDeleting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Delete inventory'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default EditInventory;
