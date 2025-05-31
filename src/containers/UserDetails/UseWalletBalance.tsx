import { Textarea } from '@mui/joy';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Alert, Box, Button, Checkbox, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { useState } from 'react'
import api from '../../api';
import { useParams } from 'react-router-dom';
import React from 'react';
import { getErrorMessage } from '../../utils/errorHandler';
import ImageUploader from '../../components/ImageUploader/ImageUploader';

type Props = {
  balances?: any
  orderId?: string
  walletId?: string
  category?: string
  selectedPackages?: any
  hideUploader?: boolean
}

const UseWalletBalance = (props: Props) => {
  const { id } = useParams();

  const [currency, setCurrency] = useState();
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

    const { walletLyd, walletUsd } = balances;
    let currentWallet = walletUsd;
    if (currency === 'LYD') {
      currentWallet = walletLyd;
    }

    if (form.amount > currentWallet) {
      setError('ليست لديك الرصيد الكافي لتقوم باستعماله، يرجى التاكد من الرصيد قبل');
      return;
    }
    if (form?.amount <= 0) {
      setError('لا يمكن اضافة 0 رصيد الى محفظة يرجى التاكد من المعلومات التي تم كتابتها')
      return;
    }
    if (files.length === 0 && !props.hideUploader) {
      return setError('يجب اضافة صورة من وصل الدفع')
    }

    const formData  = new FormData();
    const description = `تم خصم ${form?.amount + form?.currency} من المحفظة`;
    let note = `Order Id (${props.orderId || form.orderId}) => ${form?.note}`;
    if (checkbox) note = `${form.note}`;

    formData.append('description', description);
    formData.append('category', props.category ?? '');
    if (props.selectedPackages && props.selectedPackages.length > 0) {
      formData.append('list', JSON.stringify(props.selectedPackages || []));
    }
    
    for (const data in form) {
      formData.append(data, form[data]);
    }
    formData.delete('note');
    formData.append('note', note);

    if ((props.orderId || form.orderId)) {
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
            // Add action
            setError(undefined);
            window.location.reload();
          }
        })
        .catch((error) => {
          setError(getErrorMessage(error.message));
          setIsLoading(false);
        })
      // window.location.reload();
    } catch (error: any) {
      setError(error.response.data.message);
      setIsLoading(false);
    }
  }
  
  return (
    <>
      <DialogTitle>Use Balance <span style={{ color: '#236106ac' }}>({`${balances.walletUsd} $, ${balances.walletLyd} LYD`})</span></DialogTitle>
      <DialogContent>
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <form className="row" onSubmit={onSubmit}>
          <h6 className="mb-3">Wallet</h6>
          <div className='col-md-6 mb-3'>
            <LocalizationProvider required dateAdapter={AdapterDateFns}>
              <Stack spacing={3}>
                <DatePicker
                  value={date}
                  label="Received Payment Date"
                  inputFormat="dd/MM/yyyy"
                  renderInput={(params: any) => <TextField {...params} /> }                    
                  onChange={(value: any) => {
                    setDate(value);
                    onChangeHandler({ target: { value, name: 'createdAt' }});
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
              inputProps={{ inputMode: 'numeric', step: .01 }}
              required={true}
              label={'Amount'}
              onChange={onChangeHandler}
            />
            <FormControl style={{ width: '100%' }} required>
              <InputLabel id="demo-select-small">Currency</InputLabel>
              <Select
                className='connect-field-left'
                labelId={'currency'}
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

          <div className='col-md-12 mb-3'>
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
          
          <div className='col-12'>
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
              defaultChecked={!!!orderId || checkbox}
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
            <Button disabled={isLoading || (balances.walletUsd <= 0 && balances.walletLyd <= 0)} type="submit" >Use Balance</Button>
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
