import { Alert, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import api from "../../api";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import { arrayRemoveByValue, calculateTotalWallet } from "../../utils/methods";
import React from "react";
import ImageUploader from "../ImageUploader/ImageUploader";
import { getErrorMessage } from "../../utils/errorHandler";
import { useSelector } from "react-redux";
import { formatAmount } from "./wrapper-util";

import './Debts.scss';

type Props = {
  setDialog: (state: any) => void
  item?: any
  debtType?: string
  // When given, the page refreshes in place after saving instead of reloading
  onSaved?: (message: string) => void
}

const CreateDebtHistoryDialog = (props: Props) => {
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<any>({
    createdAt: date,
    debtType: props.item?.debtType
  });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<any>([]);
  const [previewFiles, setPreviewFiles] = useState<any>([]);
  const [wallet, setWallet] = useState<any>();
  const [walletLoading, setWalletLoading] = useState<boolean>(true);

  const filesRef = React.createRef();

  const { roles } = useSelector((state: any) => state.session.account);

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadWallet = async () => {
    try {
      const walletResponse = (await api.get(`wallet/${props.item.owner?._id}`)).data;
      setWallet(walletResponse?.results);
    } catch (error) {
      console.log(error);
    } finally {
      setWalletLoading(false);
    }
  }

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const payFullRemaining = () => {
    setForm({ ...form, amount: props.item?.amount, currency: props.item?.currency });
  }

  const closeDialog = () => props.setDialog({ customComponentTag: undefined, isOpen: false });

  const onSubmit = async (event: any) => {
    event.preventDefault();

    if (!form) {
      return;
    }

    const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(wallet);
    const currentWallet = form.currency === 'LYD' ? walletLyd : walletUsd;

    if (Number(form.amount) > currentWallet) {
      setError('ليست لديك الرصيد الكافي لتقوم باستعماله، يرجى التاكد من الرصيد قبل');
      return;
    }
    if (Number(form?.amount) <= 0) {
      setError('لا يمكن اضافة 0 رصيد الى محفظة يرجى التاكد من المعلومات التي تم كتابتها')
      return;
    }

    const formData  = new FormData();
    for (const data in form) {
      if (form[data] !== undefined) {
        formData.append(data, form[data]);
      }
    }

    if (files) {
      files.forEach((file: any) => {
        formData.append('files', file);
      });
    }

    formData.append('sameCurrency', form.currency === props.item.currency ? 'true' : 'false');

    setIsLoading(true);

    api.fetchFormData(`balances/${props.item._id}/paymentHistory`, 'POST', formData)
      .then((res: any) => {
        if (res?.success !== undefined && !res?.success) {
          setError(getErrorMessage(res.message));
          setIsLoading(false);
        } else {
          setError(undefined);
          if (props.onSaved) {
            setIsLoading(false);
            props.onSaved(`Payment of ${formatAmount(form.amount)} ${form.currency} saved for ${props.item?.owner?.customerId || 'customer'}`);
          } else {
            window.location.reload();
          }
        }
      })
      .catch((error) => {
        setError(getErrorMessage(error.message));
        setIsLoading(false);
      })
  }

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

  const handleFileChosen = async (file: any) => {
    return new Promise((resolve, reject) => {
      let fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        resolve(fileReader.result);
      };
    });
  }

  const previewFile = async (files: any, category: string) => {
    const results = await Promise.all(files.map(async (file: any) => {
      const fileContents = await handleFileChosen(file);
      return fileContents;
    }));

    setPreviewFiles(results);
  };

  const deleteImage = (file: never) => {
    const fileIndex = previewFiles.indexOf(file);

    const filesInput = arrayRemoveByValue(files, files[fileIndex]);
    const newPreviewFiles = arrayRemoveByValue(previewFiles, file);
    setFiles(filesInput);
    setPreviewFiles(newPreviewFiles);
  }

  const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(wallet);
  const owner = props.item?.owner;

  return (
    <form onSubmit={onSubmit}>
      <DialogTitle>
        <span className="debt-dialog-title">
          <strong>Record payment</strong>
          <span>{owner?.firstName} {owner?.lastName} ({owner?.customerId})</span>
        </span>
      </DialogTitle>

      <DialogContent>
        {error &&
          <Alert severity="error" className="mb-3">{error}</Alert>
        }

        <div className="debt-dialog-facts">
          <div>
            <span>Remaining debt</span>
            <strong className="is-owed">{formatAmount(props.item?.amount)} {props.item?.currency}</strong>
          </div>
          <div>
            <span>Wallet balance</span>
            <strong className="is-ok">
              {walletLoading ? 'Loading...' : `${formatAmount(walletUsd)} USD, ${formatAmount(walletLyd)} LYD`}
            </strong>
          </div>
        </div>

        <p className="debt-dialog-section">Payment</p>
        <div className="row g-3">
          <div className="col-sm-7">
            <div className="d-flex">
              <TextField
                fullWidth
                className='connect-field-right'
                name="amount"
                type={'number'}
                inputProps={{ inputMode: 'decimal', step: .01, min: 0 }}
                onWheel={(event: any) => event.target.blur()}
                required={true}
                label={'Amount'}
                value={form.amount ?? ''}
                onChange={onChangeHandler}
                autoFocus
              />
              <FormControl style={{ minWidth: '100px' }} required>
                <InputLabel id="payment-currency">Currency</InputLabel>
                <Select
                  className='connect-field-left'
                  labelId="payment-currency"
                  value={form.currency || ''}
                  label={'Currency'}
                  name="currency"
                  onChange={onChangeHandler}
                >
                  <MenuItem value={'USD'}>USD</MenuItem>
                  <MenuItem value={'LYD'}>LYD</MenuItem>
                </Select>
              </FormControl>
            </div>
            <div className="debt-dialog-hint">
              <span>Paid from the customer's wallet</span>
              <button type="button" className="debts-btn is-link is-small" onClick={payFullRemaining}>
                Pay full remaining
              </button>
            </div>
          </div>

          <div className='col-sm-5'>
            <TextField
              fullWidth
              name="rate"
              type={'number'}
              inputProps={{ inputMode: 'decimal', step: .01 }}
              onWheel={(event: any) => event.target.blur()}
              required={true}
              label={'Rate'}
              onChange={onChangeHandler}
            />
          </div>

          <div className='col-sm-6'>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                value={date}
                label="Payment received on"
                inputFormat="dd/MM/yyyy"
                renderInput={(params: any) => <TextField fullWidth {...params} helperText={!roles.isAdmin ? 'Only admins can change the date' : undefined} /> }
                disabled={!roles.isAdmin}
                onChange={(value: any) => {
                  setDate(value);
                  onChangeHandler({ target: { value, name: 'createdAt' }});
                }}
              />
            </LocalizationProvider>
          </div>

          <div className="col-sm-6">
            <FormControl fullWidth required>
              <InputLabel id="payment-debt-type">اختار نوع الدين</InputLabel>
              <Select
                labelId="payment-debt-type"
                value={form.debtType || ''}
                label={'اختار نوع الدين'}
                name="debtType"
                onChange={onChangeHandler}
                disabled={!!props.item?.debtType && !roles.isAdmin}
                dir="rtl"
              >
                <MenuItem dir="rtl" value={'invoice'}>دين لاجل تسديد فاتورة شراء</MenuItem>
                <MenuItem dir="rtl" value={'receivedGoods'}>دين لاجل تسديد شحن</MenuItem>
                <MenuItem dir="rtl" value={'general'}>دين عام لا يتعلق بطلبية</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="col-12">
            <TextField
              fullWidth
              multiline
              minRows={2}
              name='notes'
              label='Notes'
              helperText='Optional'
              inputProps={{ dir: 'auto' }}
              onChange={onChangeHandler}
            />
          </div>
        </div>

        <p className="debt-dialog-section mt-3">Receipts</p>
        <ImageUploader
          id={'attachments'}
          inputFileRef={filesRef}
          fileUploaderHandler={fileUploaderHandler}
          previewFiles={previewFiles}
          files={files}
          deleteImage={deleteImage}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <button type="button" className="debts-btn is-ghost" disabled={isLoading} onClick={closeDialog}>Cancel</button>
        <button type="submit" className="debts-btn is-primary" disabled={isLoading || walletLoading}>
          {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Save payment'}
        </button>
      </DialogActions>
    </form>
  )
}

export default CreateDebtHistoryDialog;
