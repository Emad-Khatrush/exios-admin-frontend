import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import { Alert, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import ImageUploader from "../../components/ImageUploader/ImageUploader";
import React, { useState } from "react";
import { arrayRemoveByValue } from "../../utils/methods";
import CustomButton from "../../components/CustomButton/CustomButton";
import api, { base } from "../../api";
import { getErrorMessage } from "../../utils/errorHandler";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@mui/joy";
import TextInput from "../../components/TextInput/TextInput";
import { AiOutlineSearch } from "react-icons/ai";
import { Invoice, Package } from "../../models";
import Card from "../../components/Card/Card";
import Badge from "../../components/Badge/Badge";

const PaymentForm = () => {

  const history = useNavigate();
  
  const [orders, setOrders] = useState<Invoice[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [cancelToken, setCancelToken] = useState();
  const [isSearching, setIsSearching] = useState(false);
  const [quickSearchDelayTimer, setQuickSearchDelayTimer] = useState();
  const [selectedPackages, setSelectedPackages] = useState<any>([]);

  const [form, setForm] = useState<any>({
    goodsSentDate: new Date()
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

    if (selectedPackages) {
      selectedPackages.forEach((file: any) => {
      });
    }
    formData.append('orders', JSON.stringify(selectedPackages));
    
    setIsLoading(true);
    api.fetchFormData(`returnedPayments`, 'POST', formData)
      .then((res: any) => {
        if (res?.success !== undefined && !res?.success) {
          setError(getErrorMessage(res.message));
          setIsLoading(false);
        } else {
          // Add action
          setError(undefined);          
          history(`/returnedPayments`);
        }
      })
      .catch((error) => {
        setError(getErrorMessage(error.message));
        setIsLoading(false);
      })
      .finally(() => {
        window.location.reload();
      })
  }

  const filterList = (event: any) => {
    if (!!event.target.value) {
      setIsSearching(true);
      clearTimeout(quickSearchDelayTimer);
      setQuickSearchDelayTimer((): any => {
        return setTimeout(async () => {
          const res = await api.get(`orders/search?tabType=all`, { cancelToken, searchValue: event.target.value, searchType: 'orderId' });
          setOrders(res?.data?.orders || []);
          setIsSearching(false);
        }, 1)
      })
    }
  }

  return (
    <div className="container">
      <form className="row" onSubmit={onSubmit}>
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <div className="col-md-12 mb-3 mt-3 p-0">
          <h4> Create Return Payment </h4>
        </div>

        <div className="col-12">
          Selected Packages
        </div>
        {selectedPackages.length > 0 && selectedPackages.map((packageDetails: Package) => (
          <div className="col-6">
            <p className="p-1 d-flex justify-content-between align-items-center" style={{ border: '1px black solid', borderRadius: '5px', fontSize: '12px' }}>
              {packageDetails.deliveredPackages.trackingNumber}
              <CustomButton
                size="small"
                onClick={(event: MouseEvent) => {
                  event.preventDefault();
                    const newData = selectedPackages.filter((data: Package) => data._id !== packageDetails._id);
                    setSelectedPackages(newData);
                }}
                color={'error'}
              >
                Remove
              </CustomButton>
            </p>
          </div>
        ))}

        {/* Search input from api */}
        <TextInput
          className="p-0"
          name="searchValue"
          placeholder={'Search For Package'}
          icon={<AiOutlineSearch />}
          onChange={(event: any) => {
            const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
            setSearchValue(event.target.value);
            setCancelToken(cancelTokenSource);
            filterList(event);
          }}
        />

        {searchValue &&
          <div style={{ height: '400px', overflow: 'auto', background: 'darkcyan', border: '1px black solid' }} className="mb-4 mt-2">
            {isSearching &&
              <CircularProgress style={{ color: 'black' }} />
            }
            {orders.length > 0 && orders.map(order => (
              <Card style={{ marginTop: '10px' }}>
                <div className="col-md-12 mb-4">
                  <p className="m-0">{order?.user?.customerId}</p>
                  <p className="m-0">{order?.orderId}</p>
                  <hr />
                  <h6>Packages (Payment Links)</h6>
                  {order?.paymentList.length > 0 ? order?.paymentList.map((packageDetails: Package, i: number) => {
                    const alreadySelectedPackage = !!selectedPackages.find((data: Package) => data._id === packageDetails._id)
                    return (
                      <div>
                        <p className="p-2" style={{ border: '1px black solid', borderRadius: '5px'}}>
                          {i + 1}.
                          <Badge text={packageDetails.deliveredPackages.trackingNumber || 'Tracking Number Not Found'} color="warning" />
                          <span className="mx-1">-</span>
                          <Badge 
                            text={`${packageDetails.deliveredPackages.weight.total || 'KG or CBM data not found'}
                            ${packageDetails.deliveredPackages.weight.measureUnit || ''}`} 
                            color="primary"
                          />
                          <CustomButton
                            size="small"
                            onClick={(event: MouseEvent) => {
                              event.preventDefault();
                              if (alreadySelectedPackage) {
                                const newData = selectedPackages.filter((data: Package) => data._id !== packageDetails._id);
                                setSelectedPackages(newData);
                                return;
                              }
                              setSelectedPackages([ ...selectedPackages, packageDetails ]);
                            }}
                            color={alreadySelectedPackage ? 'error' : 'primary'}
                          >
                            {alreadySelectedPackage ? 'Remove' : 'Select'}
                          </CustomButton>
                        </p>
                      </div>
                      )
                  })
                    :
                    <p>No Packages inside {order?.orderId}</p>
                  }
                </div>
              </Card>
            ))}
          </div>
        }

        <div className="col-md-6 mb-4 mt-2">
          <TextField
            id={'outlined-helperText'}
            name="customerId"
            required={true}
            label={'Customer Id'}
            onChange={onChangeHandler}
          />
        </div>

        <div className="d-flex col-md-6 mb-4 mt-2">
          <TextField
            className='connect-field-right'
            id={'outlined-helperText'}
            name="amount"
            type={'number'}
            inputProps={{ inputMode: 'numeric', step: .01 }}
            label={'Amount'}
            required
            onChange={onChangeHandler}
            onWheel={(event: any) => event.target.blur()}
          />
          <FormControl 
            required
            style={{ width: '100%' }}
          >
            <InputLabel id="demo-select-small">Currency</InputLabel>
            <Select
              className='connect-field-left'
              labelId={'currency'}
              id={'currency'}
              label={'Currency'}
              name="currency"
              onChange={onChangeHandler}
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

        <div className="col-md-6 mb-4">
          <TextField
            id={'outlined-helperText'}
            name="shippingCompanyName"
            required={true}
            label={'Shipping Company'}
            onChange={onChangeHandler}
          />
        </div>

        <div className="col-md-6 mb-4">
          <TextField
            id={'outlined-helperText'}
            name="deliveryTo"
            required={true}
            label={'Delivery To'}
            onChange={onChangeHandler}
          />
        </div>

        <div className="col-md-6 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Shipping Type</InputLabel>
            <Select
              labelId={'Shipping Type'}
              id={'shippingType'}
              label={'shippingType'}
              name="shippingType"
              onChange={onChangeHandler}
            >
              <MenuItem value={'air'}>
                <em> جوي </em>
              </MenuItem>
              <MenuItem value={'sea'}>
                <em> بحري </em>
              </MenuItem>
              <MenuItem value={'domestic'}>
                <em> شحن داخلي </em>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className="col-md-6 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Office</InputLabel>
            <Select
              labelId={'Office'}
              id={'issuedOffice'}
              label={'Office'}
              name="issuedOffice"
              onChange={onChangeHandler}
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
                label="Goods sent date"
                inputFormat="dd/MM/yyyy"
                value={form?.goodsSentDate || new Date()}
                renderInput={(params: any) => <TextField {...params} />} 
                onChange={(value) => onChangeHandler({ target: { name: 'goodsSentDate', value } })}
              />
            </Stack>
          </LocalizationProvider>
        </div>

        <div className="col-12 mb-4">
          <Textarea
            name='note'
            placeholder='Description'
            color="neutral"
            minRows={3}
            variant="outlined"
            onChange={onChangeHandler}
          />
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
            Create Return Payment
          </CustomButton>
        </div>
      </form>
    </div>
  )
}

export default PaymentForm;
