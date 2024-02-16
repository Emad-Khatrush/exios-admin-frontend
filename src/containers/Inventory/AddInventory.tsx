import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import { Alert, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import ImageUploader from "../../components/ImageUploader/ImageUploader";
import React, { useState } from "react";
import { arrayRemoveByValue } from "../../utils/methods";
import CustomButton from "../../components/CustomButton/CustomButton";
import api from "../../api";
import { getErrorMessage } from "../../utils/errorHandler";
import { useNavigate } from "react-router-dom";

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
      formData.append(data, form[data]);
    }
    
    if (files) {
      files.forEach((file: any) => {
        formData.append('files', file);
      });
    }

    formData.append('inventoryType', 'inventoryGoods');
    
    setIsLoading(true);

    api.fetchFormData(`inventory`, 'POST', formData)
      .then((res: any) => {
        if (res?.success !== undefined && !res?.success) {
          setError(getErrorMessage(res.message));
          setIsLoading(false);
        } else {
          // Add action
          setError(undefined);          
          history(`/inventory/${res._id}/edit`);
        }
      })
      .catch((error) => {
        setError(getErrorMessage(error.message));
        setIsLoading(false);
      })
      setIsLoading(false);

  }

  return (
    <div className="container">
      <form className="row" onSubmit={onSubmit}>
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <div className="col-md-12 mb-3 mt-3">
          <h4> Add Inventory </h4>
        </div>

        <div className="col-md-3 mb-4">
          <TextField
            id={'outlined-helperText'}
            name="voyage"
            required={true}
            label={'Voyage Number'}
            onChange={onChangeHandler}
            // defaultValue={invoice?.user?.customerId}
            // disabled={invoice?.isCanceled}
          />
        </div>

        <div className="d-flex col-md-3 mb-4">
          <TextField
            className='connect-field-right'
            id={'outlined-helperText'}
            name="voyageAmount"
            type={'number'}
            inputProps={{ inputMode: 'numeric' }}
            label={'Voyage Amount'}
            required
            onChange={onChangeHandler}
            // defaultValue={invoice?.debt?.total}
            onWheel={(event: any) => event.target.blur()}
            // disabled={invoice?.isCanceled}
          />
          <FormControl 
            required
            style={{ width: '100%' }}
          >
            <InputLabel id="demo-select-small">Currency</InputLabel>
            <Select
              className='connect-field-left'
              labelId={'currency'}
              id={'voyageCurrency'}
              // defaultValue={invoice?.debt?.currency}
              label={'Currency'}
              name="voyageCurrency"
              onChange={onChangeHandler}
              // disabled={invoice?.isCanceled}
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

        <div className="col-md-3 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Shipped Country</InputLabel>
            <Select
              labelId={'Shipped Country'}
              id={'shippedCountry'}
              // defaultValue={invoice?.placedAt}
              label={'Shipped Country'}
              name="shippedCountry"
              onChange={onChangeHandler}
              // disabled={invoice?.isCanceled}
            >
              <MenuItem value={'CN'}>
                <em> China </em>
              </MenuItem>
              <MenuItem value={'UAE'}>
                <em> UAE </em>
              </MenuItem>
              <MenuItem value={'TR'}>
                <em> Turkey </em>
              </MenuItem>
              <MenuItem value={'USA'}>
                <em> USA </em>
              </MenuItem>
              <MenuItem value={'UK'}>
                <em> UK </em>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className="col-md-4 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Inventory Place</InputLabel>
            <Select
              labelId={'Inventory Place'}
              id={'inventoryPlace'}
              // defaultValue={invoice?.placedAt}
              label={'Inventory Place'}
              name="inventoryPlace"
              onChange={onChangeHandler}
              // disabled={invoice?.isCanceled}
            >
              <MenuItem value={'tripoli'}>
                <em> Tripoli Office </em>
              </MenuItem>
              <MenuItem value={'benghazi'}>
                <em> Benghazi Office </em>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className="col-md-6 mb-4 d-flex">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={3}>
              <DatePicker
                label="Inventory Finished Date"
                inputFormat="dd/MM/yyyy"
                value={new Date()}
                renderInput={(params: any) => <TextField {...params} />} 
                onChange={(value) => onChangeHandler({ target: { name: 'inventoryFinishedDate', value } })}
              />
            </Stack>
          </LocalizationProvider>
        </div>

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

        <div className="col-12 text-end">
          <CustomButton 
            background='rgb(0, 171, 85)' 
            size="small"
            disabled={isLoading}
          >
            Create Inventory
          </CustomButton>
        </div>
      </form>
    </div>
  )
}

export default AddInventory;
