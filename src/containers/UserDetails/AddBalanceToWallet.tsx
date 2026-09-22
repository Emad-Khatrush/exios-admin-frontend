import { Textarea } from '@mui/joy';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Alert, Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import React, { useState } from 'react'
import api from '../../api';
import { useParams } from 'react-router-dom';
import { getErrorMessage } from '../../utils/errorHandler';
import ImageUploader from '../../components/ImageUploader/ImageUploader';

type Props = {}

const offices = [
  { value: 'tripoli', label: 'مكتب طرابلس' },
  { value: 'benghazi', label: 'مكتب بنغازي' },
  { value: 'bank', label: 'بنك الليبي' },
  { value: 'almutahidaTrBank', label: 'حساب الشركة المتحدة تركيا' },
  // { value: 'alipayCompany1', label: 'محفظة Alipay - الشركة' },
  // { value: 'alipayCompany2', label: 'محفظة Alipay - الشخصي' },
];

const actionTypes = [
  { value: 'cash', label: 'كاش' },
  { value: 'bank', label: 'ايداع بنك' },
  { value: 'refund', label: 'استرداد / Refund' },
  { value: 'compensation', label: 'تعويض' },
];

const AddBalanceToWallet = (props: Props) => {
  const { id } = useParams();

  const [currency, setCurrency] = useState<string>('');
  const [office, setOffice] = useState<string>('');
  const [actionType, setActionType] = useState<string>('cash');
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<any>({
    createdAt: date,
    actionType: 'cash',
  });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [previewFiles, setPreviewFiles] = useState<any>([]);
  const [files, setFiles] = useState<any>([]);
  const filesRef = React.createRef();

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
    setError('')

    if (!form) {
      return;
    }
    if (form?.amount <= 0) {
      setError('لا يمكن اضافة 0 رصيد الى محفظة يرجى التاكد من المعلومات التي تم كتابتها')
      return;
    }
    if (!form?.office) {
      return setError('يرجى اختيار المكتب')
    }
    if (!form?.actionType) {
      return setError('يرجى اختيار نوع العملية')
    }
    if (files.length === 0) {
      return setError('يجب اضافة صورة من وصل الدفع')
    }

    const description = `تم اضافة رصيد الى المحفظة بقيمة ${form?.amount} ${form?.currency}`;

    const formData = new FormData();
    formData.append('description', description);

    for (const data in form) {
      formData.append(data, form[data]);
    }

    files.forEach((file: any) => {
      formData.append('files', file);
    });

    try {
      setIsLoading(true);
      api.fetchFormData(`wallet/${id}`, 'POST', formData)
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
      <DialogTitle>Add balance to wallet</DialogTitle>
      <DialogContent>
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
              inputProps={{ inputMode: 'numeric', step: .01 }}
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

          <div className="col-md-6 mb-3">
            <FormControl style={{ width: '100%' }} required>
              <InputLabel id="office-label">مكان/حساب الايداع</InputLabel>
              <Select
                labelId="office-label"
                id="office"
                value={office}
                label="Office"
                name="office"
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

          <div className="col-md-6 mb-3">
            <FormControl style={{ width: '100%' }} required>
              <InputLabel id="action-type-label">نوع العملية</InputLabel>
              <Select
                labelId="action-type-label"
                id="actionType"
                label="نوع العملية"
                name="actionType"
                onChange={(event: any) => {
                  setActionType(event.target.value);
                  return onChangeHandler(event);
                }}
              >
                {actionTypes.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
              placeholder="قم بكتابة سبب اضافة الرصيد"
              color="neutral"
              minRows={3}
              variant="outlined"
              onChange={onChangeHandler}
              required
            />
          </Box>

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

          <DialogActions>
            <Button disabled={isLoading} type="submit">Create Balance</Button>
            {isLoading &&
              <CircularProgress />
            }
          </DialogActions>

        </form>
      </DialogContent>
    </>
  )
}

export default AddBalanceToWallet;