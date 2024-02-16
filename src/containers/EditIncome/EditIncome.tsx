import { useRef, useState, useEffect } from 'react';
import { Alert, Backdrop, Breadcrumbs, CircularProgress, FormControl, InputLabel, Link, MenuItem, Select, Snackbar, TextField, Typography } from '@mui/material';

import ImageUploader from '../../components/ImageUploader/ImageUploader';
import Card from '../../components/Card/Card';
import CustomButton from '../../components/CustomButton/CustomButton';
import { useParams } from 'react-router-dom';
import api from '../../api';

import './EditIncome.scss';

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Link underline="hover" key="2" color="inherit" href="/incomes">
    Incomes
  </Link>,
  <Typography key="3" color='#28323C'>
    Edit Income
  </Typography>,
];

type Props = {
  handleChange?: any
}

const EditIncome = (props: Props) => {
  const [ office, setOffice ] = useState();
  const [ currency, setCurrency ] = useState();
  const [ filesInput, setFilesInput ] = useState<any>([]);
  const [ previewFiles, setPreviewFiles ] = useState<any>([]);
  const [ formData, setFormData ] = useState<any>();
  const [ changedFields, setChangedFields ] = useState<any>([]);
  const [ showResponseMessage, setShowResponseMessage ] = useState<String | undefined>();
  const [ imagesLoading, setImagesLoading ] = useState<boolean>(false);
  const [ isSucceed, setIsSucceed ] = useState<boolean>(false);
  const [ isLoading, setLoading ] = useState(true);
  const { id } = useParams();

  const inputFileRef = useRef();

  useEffect(() => {
    api.get('income/' + id)
      .then(({ data }) => {
        setFormData({
          office: data.office,
          description: data.description,
          cost: data.cost.total,
          currency: data.cost.currency
        });
        setFilesInput(data.images);
        setPreviewFiles(data.images.map((img: any) => img.path ));
        setLoading(false);
      })
  }, [imagesLoading])

  const submitForm = async (event: any) => {
    event.preventDefault();
    setImagesLoading(true);
    
    api.update(`income/${id}`, {income: formData, changedFields})
      .then((res) => {
        setIsSucceed(true);
        setChangedFields([]);
        setShowResponseMessage("income has been updated successfully");
      })
      .catch(() => {
        setIsSucceed(false);
        setShowResponseMessage("Something went wrong while updating the income");
      })
      .finally(() => {
        setImagesLoading(false);
      })
  };

  const handleChange = (event: any, checked?: any) => {
    const value = event.target.inputMode === 'numeric' ? Number(event.target.value) : event.target.value;    
    const fieldName = event.target.name;
    
    setFormData({
        ...formData,
        [event.target.name]: value === 'on' ? checked : value
    })
    if (fieldName === 'cost') {
      setChangedFields({
        ...changedFields,
        cost: {
          ...changedFields.cost,
          total: value
        } 
      })
    } else if (fieldName === 'currency') {
      setChangedFields({
        ...changedFields,
        cost: {
          ...changedFields.cost,
          currency: value
        } 
      })
    } else {
      setChangedFields({
        ...changedFields,
        [event.target.name]: value === 'on' ? checked : value
      })
    }
  };

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
    setImagesLoading(true);
    await api.fetchFormData('income/uploadFiles', 'POST', data)
    
    api.get('income/' + id)
      .then(({ data }) => {
        setFormData({
          office: data.office,
          description: data.description,
          cost: data.cost.total,
          currency: data.cost.currency
        });
        setFilesInput(data.images);
        setPreviewFiles(data.images.map((img: any) => img.path ));
        setIsSucceed(true);
        setShowResponseMessage("Images uploaded successfully");
        setImagesLoading(false);
      })
    
    allFiles = [
      ...filesInput,
      ...newFiles
    ]
    
    setFilesInput(allFiles);
  }

  const deleteImage = async (file: never) => {
    setImagesLoading(true);
    const fileIndex = previewFiles.indexOf(file);    
    api.delete('income/deleteFiles', { image: filesInput[fileIndex], id })
      .then(res => {
        setIsSucceed(true);
        setShowResponseMessage("Image deleted successfully");
      })
      .catch(() => {
        setIsSucceed(false);
        setShowResponseMessage("Something went wrong while deleting the image");
      })
      .finally(() => {
        setImagesLoading(false);
      })
  }

  if (isLoading) {
    return (
      <CircularProgress />
    )
  }

  return (
    <div className="m-4">
      <Snackbar 
        open={!!showResponseMessage}
        autoHideDuration={6000}
        onClose={() => setShowResponseMessage(undefined)}
      >
        <Alert 
          severity={isSucceed ? 'success' : 'error'}
          sx={{ width: '100%' }}
          onClose={() => setShowResponseMessage(undefined)}
        >
          {showResponseMessage}
        </Alert>
      </Snackbar>

      <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={imagesLoading}
        >
        <CircularProgress color="inherit" />
      </Backdrop>
      <div style={{ maxWidth: '1400px', margin: 'auto'}}>
        <div className="col-12 mb-3">
          <h4 className='mb-2'> Edit Income</h4>
            <Breadcrumbs separator="›" aria-label="breadcrumb">
              {breadcrumbs}
            </Breadcrumbs>
        </div>
        <form 
          onSubmit={(e) => submitForm(e)}
        >
          <div className='row edit-income-page'>
            <div className="col-md-4">
              <Card>
                <ImageUploader
                  inputFileRef={inputFileRef}
                  fileUploaderHandler={fileUploaderHandler}
                  previewFiles={previewFiles}
                  deleteImage={deleteImage}
                  files={filesInput}
                />
              </Card>
            </div>

            <div className='col-md-8'>
              <Card>
                <div className="col-md-12 mb-3">
                  <h4> Income Details </h4>
                </div>

                {/* Expense Info */}
                <div className="col-md-12">
                  <p className='title'> Income Info </p>
                </div>

                <div className='row'>
                  <div className="col-md-8 mb-4">
                    <TextField
                      id={'outlined-helperText'}
                      value={formData?.description}
                      name="description"
                      required={true}
                      label={'Description'}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="d-flex col-md-4 mb-4">
                    <TextField
                      className='cost'
                      id={'outlined-helperText'}
                      value={formData?.cost}
                      name="cost"
                      type={'number'}
                      inputProps={{ inputMode: 'numeric' }}
                      required={true}
                      label={'Cost'}
                      onChange={handleChange}
                    />
                    <FormControl style={{ width: '100%' }} required>
                      <InputLabel id="demo-select-small">Currency</InputLabel>
                      <Select
                        className='currency'
                        labelId={'currency'}
                        id={'currency'}
                        value={formData?.currency}
                        label={'Currency'}
                        name="currency"
                        onChange={(event) => {
                          setCurrency(event.target.value);
                          return handleChange(event);
                        }}
                      >
                        <MenuItem value={'USD'}>
                          <em> USD </em>
                        </MenuItem>
                        <MenuItem value={'LYD'}>
                          <em> LYD </em>
                        </MenuItem>
                        <MenuItem value={'TRY'}>
                          <em> TRY </em>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>

                <div className="col-md-12 mb-4">
                  <FormControl style={{ width: '100%' }} required>
                    <InputLabel id="demo-select-small">Select Office</InputLabel>
                    <Select
                      labelId={'Select Office'}
                      id={'Select Office'}
                      defaultValue={formData?.office}
                      label={'Select Office'}
                      name="office"
                      onChange={(event) => {
                        setOffice(event.target.value);
                        return handleChange(event);
                      }}
                    >
                      <MenuItem value={"tripoli"}>
                        <em> Tripoli Office </em>
                      </MenuItem>
                      <MenuItem value={"benghazi"}>
                        <em> Benghazi Office </em>
                      </MenuItem>
                      <MenuItem value={'turkey'}>
                        <em> Turkey Office </em>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div className="col-md-12 mb-2 text-end">
                  <CustomButton 
                    background='rgb(0, 171, 85)' 
                    size="small"
                    // disabled={invoice.listStatus.isSuccess ? true : false}
                  >
                    Update Income
                  </CustomButton>
                </div>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditIncome;
