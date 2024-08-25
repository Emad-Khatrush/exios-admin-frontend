import AdapterDateFns from "@mui/lab/AdapterDateFns"
import DatePicker from "@mui/lab/DatePicker"
import LocalizationProvider from "@mui/lab/LocalizationProvider"
import { Alert, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material"
import { useState } from "react"
import api from "../../api"
import ImageUploader from "../ImageUploader/ImageUploader"
import React from "react"
import { getErrorMessage } from "../../utils/errorHandler"

type Props = {
  setDialog: (state: any) => void
  orderId?: string
  customerId: string
  category?: any
  selectedPackages?: any
}

const PayCashDialog = (props: Props) => {
  const [currency, setCurrency] = useState();
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<any>({
    createdAt: date
  });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewFiles, setPreviewFiles] = useState<any>([]);
  const [files, setFiles] = useState<any>([]);

  const filesRef = React.createRef();

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
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

  const onSubmit = async (event: any) => {
    event.preventDefault();

    if (!form) {
      return;
    }

    if (files.length === 0) {
      return setError('يجب اضافة صورة من وصل الدفع')
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
    formData.append('paymentType', 'cash');
    formData.append('customerId', props.customerId);
    formData.append('category', props.category);
    formData.append('list', JSON.stringify(props.selectedPackages));
    
    try {
      setIsLoading(true);
      api.fetchFormData(`order/${props.orderId}/payments`, 'POST', formData)
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
    } catch (error: any) {
      console.log(error);
      setError(error.response.data.message);
    }
    setIsLoading(false);
  }

  return (
    <>
      <DialogTitle>Pay Cash</DialogTitle>
      <DialogContent>
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <form className="row mt-2" onSubmit={onSubmit}>
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
              name="receivedAmount"
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
                <MenuItem value={'EURO'}>
                  <em> EURO </em>
                </MenuItem>
              </Select>
            </FormControl>
          </div>

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
            <Button disabled={isLoading} type="submit" >Add Payment</Button>
            {isLoading &&
              <CircularProgress />
            }
          </DialogActions>
        </form>
      </DialogContent>
    </>
  )
}

export default PayCashDialog;
