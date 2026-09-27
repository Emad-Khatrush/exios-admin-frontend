import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import { CircularProgress, TextField } from "@mui/material";
import ImageUploader from "../../components/ImageUploader/ImageUploader";
import React, { useState } from "react";
import { arrayRemoveByValue } from "../../utils/methods";
import api from "../../api";
import { getErrorMessage } from "../../utils/errorHandler";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { ARRIVAL_DATE_HINT, ARRIVAL_DATE_LABEL, ChoiceGroup, COUNTRY_OPTIONS, FieldLabel, OFFICE_OPTIONS, READY_DATE_HINT, READY_DATE_LABEL, SHIPPING_TYPE_OPTIONS } from "./InventoryFields";

import './InventoryForm.scss';

const AddInventory = () => {

  const history = useNavigate();

  const [form, setForm] = useState<any>({
    inventoryFinishedDate: new Date()
  });

  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [files, setFiles] = useState<any>([]);
  const [previewFiles, setPreviewFiles] = useState<any>([]);

  const filesRef = React.createRef();

  const fileUploaderHandler = async (event: any) => {
    const files = event.target.files;

    const newFiles: any =[];

    for (const file of files) {
      file.category = event.target.id;
      newFiles.unshift(file)
    }

    setFiles((previewState: any) => {
      previewFile([ ...previewState, ...newFiles ], event.target.id);
      return [ ...previewState, ...newFiles ];
    })
  }

  const previewFile = async (files: any, category: string) => {
    const results = await Promise.all(files.map(async (file: any) => {
      const fileContents = await handleFileChosen(file);
      return fileContents;
    }));

    setPreviewFiles(results);
  };

  const handleFileChosen = async (file: any) => {
    return new Promise((resolve, reject) => {
      let fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        resolve(fileReader.result);
      };
    });
  }

  const deleteImage = (file: never) => {
    const fileIndex = previewFiles.indexOf(file);

    const filesInput = arrayRemoveByValue(files, files[fileIndex]);
    const newPreviewFiles = arrayRemoveByValue(previewFiles, file);
    setFiles(filesInput);
    setPreviewFiles(newPreviewFiles);
  }

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const onSubmit = (event: any) => {
    event.preventDefault();

    if (!form) {
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

    formData.append('inventoryType', 'inventoryGoods');

    setIsLoading(true);
    setError(undefined);

    api.fetchFormData(`inventory`, 'POST', formData)
      .then((res: any) => {
        if (res?.success !== undefined && !res?.success) {
          setError(getErrorMessage(res.message));
          setIsLoading(false);
        } else {
          history(`/inventory/${res._id}/edit`);
        }
      })
      .catch((error) => {
        setError(getErrorMessage(error.message));
        setIsLoading(false);
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
            <div className="inv-field">
              <FieldLabel required>Voyage number</FieldLabel>
              <TextField
                size="small"
                fullWidth
                name="voyage"
                required
                autoFocus
                onChange={onChangeHandler}
                inputProps={{ 'aria-label': 'Voyage number' }}
              />
            </div>

            <div className="inv-field">
              <FieldLabel note="Optional">Odo reference code</FieldLabel>
              <TextField
                size="small"
                fullWidth
                name="odoReferenceCode"
                onChange={onChangeHandler}
                inputProps={{ 'aria-label': 'Odo reference code' }}
              />
            </div>

            <div className="is-wide">
              <ChoiceGroup
                name="shippedCountry"
                label="Shipped from"
                options={COUNTRY_OPTIONS}
                value={form.shippedCountry}
                onChange={onChangeHandler}
                required
              />
            </div>

            <ChoiceGroup
              name="shippingType"
              label="Shipping type"
              options={SHIPPING_TYPE_OPTIONS}
              value={form.shippingType}
              onChange={onChangeHandler}
              required
            />

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
                <DatePicker
                  inputFormat="dd/MM/yyyy"
                  value={form?.inventoryFinishedDate || new Date()}
                  renderInput={(params: any) => <TextField {...params} size="small" fullWidth />}
                  onChange={(value) => onChangeHandler({ target: { name: 'inventoryFinishedDate', value } })}
                />
              <span className="inv-hint">{READY_DATE_HINT}</span>
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
                previewFiles={previewFiles}
                files={files}
                deleteImage={deleteImage}
              />
            </div>
          </div>
        </section>

        <div className="inv-actionbar">
          <span>Fields marked * are required</span>
          <div>
            <Link className="inv-btn is-ghost" to="/inventory">Cancel</Link>
            <button type="submit" className="inv-btn is-primary" disabled={isLoading}>
              {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Create inventory'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddInventory;
