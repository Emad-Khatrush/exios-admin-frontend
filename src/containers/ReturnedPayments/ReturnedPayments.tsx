import { AiOutlineSearch } from "react-icons/ai";
import CustomButton from "../../components/CustomButton/CustomButton";
import { Breadcrumbs, Button, CircularProgress, Dialog, DialogActions, DialogContent, FormControl, InputLabel, Link, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import Card from "../../components/Card/Card";
import TextInput from "../../components/TextInput/TextInput";
import InfoTable from "../../components/InfoTable/InfoTable";
import { useEffect, useState } from "react";
import api from "../../api";
import { defaultColumns, generateDataToListType } from "./generateData";
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper";
import Badge from "../../components/Badge/Badge";
import PaymentForm from "./PaymentForm";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import DatePicker from "@mui/lab/DatePicker";
import { useSelector } from "react-redux";
import { Account } from "../../models";

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Returned Payments
  </Typography>,
];

const ReturnedPayments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [returnedPayments, setReturnedPayments] = useState([]);
  const [previewImages, setPreviewImages] = useState();
  const [searchValue, setSearchValue] = useState('');
  const [createPaymentDialog, setCreatePaymentDialog] = useState(false);
  const [finishPayment, setFinishPayment] = useState<any>();
  const [meta, setMeta] = useState<any>({
    counts: {
      active: 0,
      waitingApproval: 0,
      finished: 0
    }
  });
  const [finishForm, setFinishForm] = useState<any>({
    paidDate: new Date()
  });
  const account: Account = useSelector((state: any) => state.session?.account);
  const { isAdmin } = account.roles;

  useEffect(() => {
    getAllData();
  }, [])

  const getAllData = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('returnedPayments?status=active');
      setReturnedPayments(response.data.results);
      setMeta(response.data.meta);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  const onSelectorChange = async (value: string) => {
    try {
      setIsLoading(true)
      const response = await api.get(`returnedPayments?status=${value}`);
      setReturnedPayments(response.data.results);
      setMeta(response.data.meta);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  const onChangeHandler = (event: any) => {
    setFinishForm({ ...finishForm, [event.target.name]: event.target.value });
  }

  const filterList = (list: any[]) => {
    let filteredList = list;
    return filteredList.filter(data => (
      (`${data.customer.firstName} ${data.customer.lastName}` || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.deliveryTo || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.customer.customerId || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data?._id || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 || 
      searchInsideOrders(data?.orders, searchValue)
    ))
  }

  const onFinishPayment = async (event: any, status: string) => {
    event.preventDefault();
    try {
      setIsLoading(true);
      await api.update('returnedPayments', { ...finishForm, _id: finishPayment._id, status });
      window.location.reload();
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns = [...defaultColumns(setPreviewImages, setFinishPayment)];
  const filteredList = generateDataToListType(filterList(returnedPayments));

  const tabs: any = [
    {
      label: 'Active Payments',
      value: 'active',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(meta.counts.active)} color="primary" />
    },
    {
      label: 'Finished Payments',
      value: 'finished',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(meta.counts.finished)} color="success" />
    },
  ]
  if (isAdmin) {
    tabs.splice(1, 0, {
      label: 'Waiting Approval Payments',
      value: 'waitingApproval',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(meta.counts.waitingApproval)} color="sky" />
    })
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <h4 className='mb-2'>Returned Payments Table</h4>
          <div className='mb-4 d-flex justify-content-between'>
            <Breadcrumbs separator="›" aria-label="breadcrumb">
              {breadcrumbs}
            </Breadcrumbs>

            <CustomButton 
              background='rgb(0, 171, 85)' 
              size="small"
              onClick={() => {
                setCreatePaymentDialog(true);
              }}
            >
            Add New Return Payment
          </CustomButton>
          </div>
        </div>

        <div className="col-12">
          <Card
            tabs={tabs}
            tabsOnChange={onSelectorChange}
          >
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
              <TextInput 
                placeholder="Search for data" 
                icon={<AiOutlineSearch />}
                onChange={(event: any) => setSearchValue(event.target.value)}
              />
            </div>
            {isLoading ?
              <CircularProgress />
              :
              <InfoTable
                columns={columns}
                data={filteredList}
              />
            }
          </Card>
        </div>
      </div>

      <Dialog open={!!previewImages} onClose={() => setPreviewImages(undefined)}>
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)} >Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createPaymentDialog}>
        <DialogContent>
          <PaymentForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatePaymentDialog(false)} >Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!finishPayment}>
        <DialogContent>
          <h6>Finish Payment</h6>
          <form onSubmit={(event) => onFinishPayment(event, finishPayment?.status === 'waitingApproval' ? 'finished' : 'waitingApproval')}>
            {finishPayment?.status === 'waitingApproval' ?
              <div className="col-md-12 mb-4 mt-2">
                <TextField
                  id={'outlined-helperText'}
                  name="paymentFound"
                  required={true}
                  label={'Payment Found Place'}
                  onChange={onChangeHandler}
                />
              </div>
              :
              <div>
                <div className="d-flex col-md-12 mb-4 mt-2">
                  <TextField
                    className='connect-field-right'
                    id={'outlined-helperText'}
                    name="paidAmount"
                    type={'number'}
                    inputProps={{ inputMode: 'numeric', step: .01 }}
                    label={'Customer Paid Amount'}
                    required
                    onChange={onChangeHandler}
                    onWheel={(event: any) => event.target.blur()}
                  />
                  <FormControl 
                    required
                    style={{ width: '50%' }}
                  >
                    <InputLabel id="demo-select-small">Currency</InputLabel>
                    <Select
                      className='connect-field-left'
                      labelId={'paidAmountCurrency'}
                      id={'paidAmountCurrency'}
                      label={'Currency'}
                      name="paidAmountCurrency"
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

                <div className="col-md-12 mb-4 d-flex">
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Stack spacing={3}>
                      <DatePicker
                        label="Paid date"
                        inputFormat="dd/MM/yyyy"
                        value={finishForm.paidDate}
                        renderInput={(params: any) => <TextField {...params} />} 
                        onChange={(value) => onChangeHandler({ target: { name: 'paidDate', value } })}
                      />
                    </Stack>
                  </LocalizationProvider>
                </div>
              </div>
            }
            <div className="col-12 text-end">
              <CustomButton 
                background='rgb(0, 171, 85)' 
                size="small"
                disabled={isLoading}
              >
                Finish Payment
              </CustomButton>
            </div>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinishPayment(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

const searchInsideOrders = (orders: any = [], value: string) => {
  for (const packageDetails of orders) {
    if ((packageDetails?.deliveredPackages?.trackingNumber || "").toLocaleLowerCase().indexOf(value.toLocaleLowerCase()) > -1) {
      return true;
    }
  }
  return false;
}

export default ReturnedPayments;
