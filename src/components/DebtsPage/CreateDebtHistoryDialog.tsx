import { Textarea } from "@mui/joy";
import { Alert, Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
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

type Props = {
  setDialog: (state: any) => void
  item?: any
  debtType?: string
}

const CreateDebtHistoryDialog = (props: Props) => {
  const [currency, setCurrency] = useState();
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<any>({
    createdAt: date
  });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<any>([]);
  const [previewFiles, setPreviewFiles] = useState<any>([]);
  const [wallet, setWallet] = useState<any>();
  const [debtType, setDebtType] = useState(props.item?.debtType);

  const filesRef = React.createRef();

  const { roles } = useSelector((state: any) => state.session.account);
  

  useEffect(() => {
    loadWallet();    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadWallet = async () => {
    const walletResponse = (await api.get(`wallet/${props.item.owner?._id}`)).data;
    setWallet(walletResponse?.results);
  }

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const onSubmit = async (event: any) => {
    event.preventDefault();

    if (!form) {
      return;
    }

    // if (files.length === 0) {
    //   return setError('يجب اضافة صوره من وصل الخاص بالدين')
    // }

  const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(wallet);

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

    const formData  = new FormData();
    for (const data in form) {
      formData.append(data, form[data]);
    }
    
    if (files) {
      files.forEach((file: any) => {
        formData.append('files', file);
      });
    }

    formData.append('sameCurrency', form.currency === props.item.currency ? 'true' : 'false');
    if (!formData.get('debtType')) {
      formData.append('debtType', debtType);
    }
    
    setIsLoading(true);

    api.fetchFormData(`balances/${props.item._id}/paymentHistory`, 'POST', formData)
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

    setIsLoading(false);
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
  
  return (
    <>
      <DialogTitle>Create Payment History <span style={{ color: 'rgb(236, 72, 72)' }}>({props.item?.amount} {props.item?.currency})</span></DialogTitle>
        <DialogContent>
          {error &&
            <Alert className="mb-2" color="error">
              {error}
            </Alert>
          }
          <p className="my-0" style={{ color: 'rgba(35, 97, 6, 0.675)' }}>Wallet({props.item?.owner?.customerId}) ({`${walletUsd} $, ${walletLyd} LYD`})</p>
          <form className="row" onSubmit={onSubmit}>
            <h6 className="mb-3">Payment Info</h6>
            <div className='col-md-5 mb-3'>
              <LocalizationProvider required dateAdapter={AdapterDateFns}>
                <Stack spacing={3}>
                  <DatePicker
                    value={date}
                    label="Received Payment Date"
                    inputFormat="dd/MM/yyyy"
                    renderInput={(params: any) => <TextField {...params} /> }          
                    disabled={!roles.isAdmin}          
                    onChange={(value: any) => {
                      setDate(value);
                      onChangeHandler({ target: { value, name: 'createdAt' }});
                    }}
                  />
                </Stack>
              </LocalizationProvider>
            </div>

            <div className='col-md-2 col-sm-12 mb-3'>
              <TextField
                id={'outlined-helperText'}
                name="rate"
                type={'number'}
                inputProps={{ inputMode: 'numeric', step: .01 }}
                required={true}
                label={'Rate'}
                onChange={onChangeHandler}
              />
            </div>

            <div className="d-flex col-md-5 mb-2">
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

            <div className="d-flex col-md-12 mb-4">
              <FormControl style={{ width: '100%' }} required>
                <InputLabel id="demo-select-small">اختار نوع الدين</InputLabel>
                <Select
                  labelId={'debtType'}
                  id={'debtType'}
                  defaultValue={debtType}
                  label={'Debt Type'}
                  name="debtType"
                  onChange={(event: any) => {
                    setDebtType(event.target.value);
                    return onChangeHandler(event);
                  }}
                  disabled={debtType && !roles.isAdmin}
                >
                  <MenuItem value={'invoice'}>
                    <em> دين لاجل تسديد فاتورة شراء </em>
                  </MenuItem>
                  <MenuItem value={'receivedGoods'}>
                    <em> دين لاجل تسديد شحن </em>
                  </MenuItem>
                  <MenuItem value={'general'}>
                    <em> دين عام لا يتعلق بطلبية </em>
                  </MenuItem>
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
                name='notes'
                placeholder='Notes'
                color="neutral"
                minRows={3}
                variant="outlined"
                onChange={onChangeHandler}
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
                deleteImage={deleteImage}
              />
            </div>

            <DialogActions>
              <Button disabled={isLoading} color="error" onClick={() => props.setDialog({ customComponentTag: undefined, isOpen: false })} >Close</Button>
              <Button disabled={isLoading} type="submit" >Create Payment</Button>
              {isLoading &&
                <CircularProgress />
              }
            </DialogActions>

          </form>
        </DialogContent>
    </>
  )
}

export default CreateDebtHistoryDialog;
