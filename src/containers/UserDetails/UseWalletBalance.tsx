import { Textarea } from '@mui/joy';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Alert, Box, Button, Checkbox, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import React, { useEffect, useState } from 'react'
import api from '../../api';
import { useParams } from 'react-router-dom';
import { getErrorMessage } from '../../utils/errorHandler';
import ImageUploader from '../../components/ImageUploader/ImageUploader';
import { useOffices } from '../../utils/useOffices';
import { errorText, sys } from '../Accounting/accountingApi';

type Props = {
  balances?: any
  orderId?: string
  walletId?: string
  category?: string
  selectedPackages?: any
  hideUploader?: boolean
  actionType?: 'cash' | 'refund' | 'compensation' | 'wallet' | 'withdrawal'
}

const UseWalletBalance = (props: Props) => {
  // Offices are data (spec C4)
  const offices = useOffices().map((o) => ({ value: o.code, label: o.nameEn || o.name }));
  const { id } = useParams();

  const [currency, setCurrency] = useState<string>('');
  const [office, setOffice] = useState<string>('');
  const [withdrawalSource, setWithdrawalSource] = useState<'box' | 'custody'>('box');
  const [withdrawalOptions, setWithdrawalOptions] = useState<{ custody?: Record<string, number>; office?: string; anyOffice?: boolean } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(props.actionType === 'withdrawal');
  const [optionsError, setOptionsError] = useState('');
  const held = Number(withdrawalOptions?.custody?.[currency] || 0);
  const hasCustody = Object.values(withdrawalOptions?.custody || {}).some((amount) => amount > 0);
  const [checkbox, setCheckbox] = useState(true);
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<any>({
    createdAt: date
  });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewFiles, setPreviewFiles] = useState<any>([]);
  const [files, setFiles] = useState<any>([]);
  const filesRef = React.createRef();

  const { balances, orderId } = props;

  useEffect(() => {
    if (props.actionType !== 'withdrawal') return;
    let active = true;
    sys.get('office-expenses/options').then((res: any) => {
      if (!active) return;
      setWithdrawalOptions(res.data);
      setOffice(res.data.office || '');
    }).catch((err: any) => {
      if (active) setOptionsError(errorText(err, 'تعذر تحميل خيارات السحب. أغلق النافذة وافتحها مجددًا.'));
    }).finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [props.actionType]);

  const handleFileChosen = async (file: any) => {
    return new Promise((resolve, reject) => {
      let fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        resolve(fileReader.result);
      };
      fileReader.onerror = reject;
    });
  }

  const previewFile = async (files: any, category: string) => {
    const results = await Promise.all(files.map(async (file: any) => {
      const fileContents = await handleFileChosen(file);
      return fileContents;
    }));

    setPreviewFiles(results);
  };

  const fileUploaderHandler = async (event: any) => {
    const files = event.target.files;

    const newFiles: any = [];

    for (const file of files) {
      file.category = event.target.id;
      newFiles.unshift(file)
    }

    setFiles((previewState: any) => {
      previewFile([...previewState, ...newFiles], event.target.id);
      return [...previewState, ...newFiles];
    })
  }

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const onSubmit = async (event: any) => {
    event.preventDefault();
    setError('');

    if (!form || !currency) {
      setError('الرجاء تعبيئة جميع الخانات');
      return;
    }

    if (isLoading || optionsLoading) return;
    if (props.actionType === 'withdrawal' && optionsError) { setError(optionsError); return; }
    if (props.actionType === 'withdrawal' && withdrawalSource === 'box' && !office) {
      setError('يرجى اختيار المكتب');
      return;
    }

    const { walletLyd, walletUsd } = balances;
    let currentWallet = walletUsd;
    if (currency === 'LYD') {
      currentWallet = walletLyd;
    }

    if (form.amount > currentWallet) {
      setError('ليست لديك الرصيد الكافي لتقوم باستعماله، يرجى التاكد من الرصيد قبل');
      return;
    }
    if (!Number.isFinite(Number(form?.amount)) || !(Number(form?.amount) > 0)) {
      setError('لا يمكن اضافة 0 رصيد الى محفظة يرجى التاكد من المعلومات التي تم كتابتها')
      return;
    }
    if (props.actionType === 'withdrawal' && withdrawalSource === 'custody' && Math.round(Number(form.amount) * 100) > Math.round(held * 100)) {
      setError(`رصيد عهدتك المتاح ${held.toLocaleString('en-US')} ${currency} لا يكفي لهذا السحب`);
      return;
    }
    if (files.length === 0 && !props.hideUploader) {
      return setError('يجب اضافة صورة من وصل الدفع')
    }

    const formData = new FormData();
    const description = `تم خصم ${form?.amount} ${form?.currency} من المحفظة`;
    let note = `Order Id (${props.orderId || form.orderId}) => ${form?.note}`;
    if (!checkbox) note = `${form.note}`;

    formData.append('description', description);
    formData.append('category', props.category ?? '');
    if (props.actionType) {
      formData.append('actionType', props.actionType);
    }
    if (props.selectedPackages && props.selectedPackages.length > 0) {
      formData.append('list', JSON.stringify(props.selectedPackages || []));
    }

    for (const data in form) {
      formData.append(data, form[data]);
    }
    if (props.actionType === 'withdrawal') {
      formData.set('withdrawalSource', withdrawalSource);
      if (office) formData.set('office', office);
    }
    formData.delete('note');
    formData.append('note', note);

    if (props.orderId || form.orderId) {
      formData.delete('orderId');
      formData.append('orderId', props.orderId || form.orderId)
    }

    files.forEach((file: any) => {
      formData.append('files', file);
    });

    try {
      setIsLoading(true);
      api.fetchFormData(`wallet/${props.walletId || id}/usebalance`, 'POST', formData)
        .then((res: any) => {
          if (res?.success !== undefined && !res?.success) {
            setError(getErrorMessage(res.message));
            setIsLoading(false);
          } else {
            setError(undefined);
            window.location.reload();
          }
        })
        .catch((error) => {
          setError(getErrorMessage(error.message));
          setIsLoading(false);
        })
    } catch (error: any) {
      setError(error?.response?.data?.message);
      setIsLoading(false);
    }
  }

  return (
    <>
      <DialogTitle>Use Balance <span style={{ color: '#236106ac' }}>({`${balances.walletUsd} $, ${balances.walletLyd} LYD`})</span></DialogTitle>
      <DialogContent>
        {optionsError && <Alert severity="error" className="mb-2">{optionsError}</Alert>}
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <form className="row" onSubmit={onSubmit}>
          <h6 className="mb-3">Wallet</h6>
          <div className='col-md-6 mb-3'>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack spacing={3}>
                <DatePicker
                  value={date}
                  label="Received Payment Date"
                  inputFormat="dd/MM/yyyy"
                  renderInput={(params: any) => <TextField {...params} />}
                  onChange={(value: any) => {
                    setDate(value);
                    onChangeHandler({ target: { value, name: 'createdAt' } });
                  }}
                />
              </Stack>
            </LocalizationProvider>
          </div>

          <div className="d-flex col-md-6 mb-2">
            <TextField
              className='connect-field-right'
              id={'outlined-helperText'}
              name="amount"
              type={'number'}
              inputProps={{ inputMode: 'decimal', step: .01, min: .01, ...(props.actionType === 'withdrawal' && withdrawalSource === 'custody' ? { max: held } : {}) }}
              required={true}
              label={'Amount'}
              onChange={onChangeHandler}
            />
            <FormControl style={{ width: '100%' }} required>
              <InputLabel id="currency-label">Currency</InputLabel>
              <Select
                className='connect-field-left'
                labelId={'currency-label'}
                id={'currency'}
                value={currency}
                label={'Currency'}
                name="currency"
                onChange={(event: any) => {
                  setCurrency(event.target.value);
                  return onChangeHandler(event);
                }}
              >
                <MenuItem value={'USD'}>
                  <em> USD </em>
                </MenuItem>
                <MenuItem value={'LYD'}>
                  <em> LYD </em>
                </MenuItem>
              </Select>
            </FormControl>
          </div>

          {props.actionType === 'withdrawal' && hasCustody && <div className="col-12 mb-3">
            <TextField select fullWidth label="مصدر السحب النقدي" value={withdrawalSource} disabled={isLoading || optionsLoading}
              onChange={(event) => setWithdrawalSource(event.target.value as 'box' | 'custody')}
              helperText={withdrawalSource === 'custody' ? `المتاح من عهدتك: ${held.toLocaleString('en-US')} ${currency || '—'}. لا يمكن تجاوز هذا الرصيد.` : 'يُصرف المبلغ من خزينة الفرع، ولا يُخصم من عهدتك.'}>
              <MenuItem value="box">خزينة الفرع</MenuItem>
              <MenuItem value="custody" disabled={!currency || held <= 0}>عهدتي · {held.toLocaleString('en-US')} {currency || '—'}</MenuItem>
            </TextField>
          </div>}

          {props.actionType === 'withdrawal' && withdrawalSource === 'box' &&
            <div className='col-md-6 mb-3'>
              <FormControl style={{ width: '100%' }} required>
                <InputLabel id="office-label">Office</InputLabel>
                <Select
                  labelId="office-label"
                  id="office"
                  value={office}
                  label="Office"
                  name="office"
                  disabled={isLoading || optionsLoading || withdrawalOptions?.anyOffice === false}
                  onChange={(event: any) => {
                    setOffice(event.target.value);
                    return onChangeHandler(event);
                  }}
                >
                  {offices.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          }

          <div className='col-md-6 mb-3'>
            <TextField
              id={'outlined-helperText'}
              name="rate"
              type={'number'}
              inputProps={{ inputMode: 'numeric', step: .01 }}
              required={true}
              label={'Rate / سعر الصرف'}
              placeholder="اذا لا يوجد ضع 0"
              onChange={onChangeHandler}
            />
          </div>

          <div className='col-md-6 col-12'>
            <TextField
              id={'outlined-helperText'}
              name="orderId"
              type={'text'}
              required={true}
              label={'Order Id'}
              onChange={onChangeHandler}
              disabled={!!orderId || checkbox}
              defaultValue={orderId}
            />
            <Checkbox
              defaultChecked={!orderId || checkbox}
              onChange={(e: any, checked) => setCheckbox(checked)}
              disabled={!!orderId}
            />
            خصم بدون كود
          </div>

          <Box
            sx={{
              py: 2,
              display: 'grid',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Textarea
              name='note'
              placeholder='قم بكتابة سبب خصم الرصيد في العملية هذه'
              color="neutral"
              minRows={3}
              variant="outlined"
              onChange={onChangeHandler}
              required
            />
          </Box>

          {!props.hideUploader &&
            <div className='col-md-4 mt-3'>
              <h6>Upload Files</h6>
              <ImageUploader
                id={'attachments'}
                inputFileRef={filesRef}
                fileUploaderHandler={fileUploaderHandler}
                previewFiles={previewFiles}
                files={files}
              />
            </div>
          }

          <DialogActions>
            <Button disabled={isLoading || optionsLoading || !!optionsError || (props.actionType === 'withdrawal' && withdrawalSource === 'custody' && (held <= 0 || Number(form.amount) > held)) || (balances.walletUsd <= 0 && balances.walletLyd <= 0)} type="submit">{props.actionType === 'withdrawal' ? 'تأكيد السحب النقدي' : 'Use Balance'}</Button>
            {isLoading &&
              <CircularProgress />
            }
          </DialogActions>

        </form>
      </DialogContent>
    </>
  )
}

export default UseWalletBalance;
