import * as React from 'react';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Badge from '../Badge/Badge';
import api from '../../api';
import { Inventory } from '../../models';
import { Alert, Autocomplete, Backdrop, ButtonGroup, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Switch, TextField } from '@mui/material';
import { FaWarehouse, FaWhatsapp } from "react-icons/fa";
import { countries, orderActions } from '../../containers/EditInvoice/EditInvoice';
import CustomButton from '../CustomButton/CustomButton';

function not(a: readonly number[], b: readonly number[]) {
  return a.filter((value) => b.indexOf(value) === -1);
}

function intersection(a: readonly number[], b: readonly number[]) {
  return a.filter((value) => b.indexOf(value) !== -1);
}

function union(a: readonly number[], b: readonly number[]) {
  return [...a, ...not(b, a)];
}

type Props = {
  takenOrders: any
  orders: any
  inventory: Inventory
}

const TransferOrdersList = (props: Props) => {
  const [checked, setChecked] = React.useState<readonly number[]>([]);
  const [left, setLeft] = React.useState<readonly number[]>([]);
  const [right, setRight] = React.useState<readonly number[]>([]);

  const [ showResponseMessage, setShowResponseMessage ] = React.useState<String | undefined>();
  const [ isSucceed, setIsSucceed ] = React.useState<boolean>(false);
  const [ isLoading, setLoading ] = React.useState(false);
  const [ showDialog, setShowDialog ] = React.useState(false);
  const [ activity, setActivity ] = React.useState({
    country: '',
    description: ''
  });
  const [ whatsupMessage, setWhatsupMessage ] = React.useState('');

  
  React.useEffect(() => {
    const searchedOrders = props.orders.filter((order: any) => {
      const orderFound = right.find((data: any) => data?.paymentList?._id === order.paymentList?._id);
      if (orderFound) {
        return false;
      }
      return  true;
    })
    
    setLeft(searchedOrders);
  }, [props.orders])

  React.useEffect(() => {
    setRight(props.takenOrders);
  }, [props.takenOrders])

  const leftChecked = intersection(checked, left);
  const rightChecked = intersection(checked, right);

  const handleToggle = (value: number) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const numberOfChecked = (items: readonly number[]) => intersection(checked, items).length;

  const handleToggleAll = (items: readonly number[]) => () => {
    if (numberOfChecked(items) === items.length) {
      setChecked(not(checked, items));
    } else {
      setChecked(union(checked, items));
    }
  };

  const handleCheckedRight = async () => {
    try {
      const res = await api.update(`inventory/orders?id=${props.inventory?._id}`, leftChecked);
      const inventory = res.data;
      setLeft(not(left, leftChecked));
      setChecked(not(checked, leftChecked));
      setRight(inventory.orders);
      setShowResponseMessage('تم اضافة طلبيات الى قائمة الجرد بنجاح');
      setIsSucceed(true);
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل في تحميل طلبيات الى قائمة الجرد يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckedLeft = async () => {
    try {
      setLoading(true);
      await api.delete(`inventory/orders?id=${props.inventory?._id}`, rightChecked);
      setRight(not(right, rightChecked));
      setChecked(not(checked, rightChecked));
      setLeft(left);
      setShowResponseMessage('تم حذف طلبيات من قائمة الجرد بنجاح');
      setIsSucceed(true);
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل في حذف طلبيات من قائمة الجرد يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedOrdersStatus = async () => {
    try {
      setLoading(true);
      await api.update(`orders/status`, { data: rightChecked, statusType: 'arrivedLibya', value: true, inventoryId: props.inventory?._id });
      setShowResponseMessage('تم تحديث طلبيات بنجاح');
      setIsSucceed(true);
      setChecked([])
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل الطلب، يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const whatsup = async () => {
    try {
      setLoading(true);
      await api.update(`orders/status`, { data: rightChecked, statusType: 'arrivedLibya', value: true });
      setShowResponseMessage('تم تحديث طلبيات بنجاح');
      setIsSucceed(true);
      setChecked([])
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل الطلب، يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const submitNewActivity = (event: React.MouseEvent) => {
    event.preventDefault();    
    const { description, country } = activity;
    
    if (!description || !country) {
      return;
    }
    setLoading(true);
    
    checked.forEach((data: any) => {
      api.post(`order/${data.order._id}/addActivity`, activity)
        .then(() => {
          setShowResponseMessage('New activity has been added successfully');
          setIsSucceed(true);
          setActivity({
            country: '',
            description: ''
          })
        })
        .catch((err) => {
          setShowResponseMessage(err.data.message);
          setIsSucceed(false);
        })
    })
    setLoading(false);
  }

  const customList = (title: React.ReactNode, items: readonly number[]) => {
    return (
      <Card className='mt-2'>
        <p className='p-1 text-center'>قائمة البحث</p>

        <CardHeader
          sx={{ px: 2, py: 1 }}
          avatar={
            <Checkbox
              onClick={handleToggleAll(items)}
              checked={numberOfChecked(items) === items.length && items.length !== 0}
              indeterminate={
                numberOfChecked(items) !== items.length && numberOfChecked(items) !== 0
              }
              disabled={items.length === 0}
              inputProps={{
                'aria-label': 'all items selected',
              }}
            />
          }
          title={title}
          subheader={`${numberOfChecked(items)}/${items.length} selected`}
        />
        <Divider />
        <List
          sx={{
            width: 400,
            height: 400,
            bgcolor: 'background.paper',
            overflow: 'auto',
            flexDirection: 'column'
          }}
          dense
          component="div"
          role="list"
        >
          {items.map((value: any) => {
            const labelId = `transfer-list-all-item-${value}-label`;

            return (
              <ListItem
                key={value}
                role="listitem"
                button
                onClick={handleToggle(value)}
              >
                <ListItemIcon>
                  <Checkbox
                    checked={checked.indexOf(value) !== -1}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{
                      'aria-labelledby': labelId,
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  id={labelId}
                  primary={
                    <div>
                      <p className='m-0'>
                        <a style={{ textDecoration: 'none' }} className='m-0' href={`/invoice/${value?._id}/edit`} target='__blank'>{value.orderId}</a>
                      </p>
                      <p className='m-0'>{`${value?.customerInfo?.fullName}`}</p>
                      <Badge text={`Tracking Number: ${value?.paymentList?.deliveredPackages?.trackingNumber} `} />
                    </div>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Card>
    )
  }

  const sendWhatsupMessage = async () => {
    if (!whatsupMessage) {
      return;
    }

   setLoading(true);

   checked.forEach((data: any) => {
     api.post(`sendWhatsupMessage`, { phoneNumber: `${data.order.customerInfo.phone}@c.us`, message: whatsupMessage })
       .then((res) => {
         setShowResponseMessage('Whatsup message has been send successfully');
         setIsSucceed(true);
       })
       .catch((err) => {
         console.log(err);
         setShowResponseMessage(err.response.data.message === 'whatsup-auth-not-found' ? 'You need to scan QR from your whatsup !' : err.response.data.message);
         setIsSucceed(false);
       })
   })
   setLoading(false);
  }

  const customListForChosen = (title: React.ReactNode, items: readonly number[]) => {
    const filteredItems = items;

    return (
      <Card className='mt-2'>
        <p className='p-1 text-center'>البضائع في قائمة الجرد</p>
        <CardHeader
          sx={{ px: 2, py: 1 }}
          avatar={
            <Checkbox
              onClick={handleToggleAll(filteredItems)}
              checked={numberOfChecked(filteredItems) === filteredItems.length && filteredItems.length !== 0}
              indeterminate={
                numberOfChecked(filteredItems) !== filteredItems.length && numberOfChecked(filteredItems) !== 0
              }
              disabled={filteredItems.length === 0}
              inputProps={{
                'aria-label': 'all items selected',
              }}
            />
          }
          title={title}
          subheader={`${numberOfChecked(filteredItems)}/${filteredItems.length} selected`}
        />
        <Divider />
        <List
          sx={{
            width: 400,
            height: 400,
            bgcolor: 'background.paper',
            overflow: 'auto',
            flexDirection: 'column'
          }}
          dense
          component="div"
          role="list"
        >
          {items.map((order: any) => {
            console.log(order);
            
            return (
              <ListItem
                key={order}
                role="listitem"
                button
                onClick={handleToggle(order)}
              >
                <ListItemIcon>
                  <Checkbox
                    checked={checked.indexOf(order) !== -1}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{
                      'aria-labelledby': order,
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  id={order}
                  primary={
                    <div>
                      <p className='m-0'>
                        <a style={{ textDecoration: 'none' }} className='m-0' href={`/invoice/${order?._id}/edit`} target='__blank'>
                          {order?.orderId}
                        </a>
                        <Badge text={`${order?.paymentList?.status?.arrivedLibya ? 'وصلت ليبيا' : 'لم تصل ليبيا'} `} />
                      </p>
                      <p className='m-0'>{`${order?.customerInfo?.fullName}`}</p>
                      <Badge text={`Tracking Number: ${order?.paymentList?.deliveredPackages?.trackingNumber} `} />
                    </div>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Card>
    )
  }

  return (
    <Grid container spacing={2} justifyContent="center" alignItems="center">
      <Grid item>{customList('Choices', left)}</Grid>
      
      <Grid item>
        <Grid container direction="column" alignItems="center">
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onDoubleClick={handleCheckedRight}
            disabled={leftChecked.length === 0}
            aria-label="move selected right"
          >
            &gt;
          </Button>
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onDoubleClick={handleCheckedLeft}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            &lt;
          </Button>
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onDoubleClick={updateSelectedOrdersStatus}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            <FaWarehouse />
          </Button>
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onClick={() => setShowDialog(true)}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            <FaWhatsapp />
          </Button>
        </Grid>
      </Grid>

      <Grid item>{customListForChosen('Chosen', right)}</Grid>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} className='p-5' fullWidth>
        <DialogContent>
          <form
            onSubmit={(event: any) => submitNewActivity(event)}
          >
            <h5 className='mb-3'> Add Activity </h5>
            <div className="row">
              <div className="col-md-12 mb-4">
                <Autocomplete
                  disablePortal
                  id="free-solo-demo"
                  freeSolo
                  options={countries}
                  onChange={(event: any) => (
                    setActivity({
                      ...activity,
                      country: event.target.innerText
                    })
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      id={'outlined-helperText'}
                      name="country"
                      required={true}
                      label={'Country'}
                      defaultValue={activity.country}
                      onChange={(event: any) => (
                        setActivity({
                          ...activity,
                          country: event.target.innerText
                        })
                      )}
                      style={{ direction: 'rtl' }}
                      disabled={isLoading}
                    />
                  )}
                />
              </div>

              <div className="col-md-12 mb-4">
                <Autocomplete
                  disablePortal
                  id="free-solo-demo"
                  freeSolo
                  options={orderActions}
                  onChange={(event: any) => setActivity({
                    ...activity,
                    description: event.target.innerText
                  })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      id={'outlined-helperText'}
                      name="description"
                      required={true}
                      label={'Description'}
                      defaultValue={activity.description}
                      onChange={(event: any) => ( 
                        setActivity({
                          ...activity,
                          description: event.target.value
                        })
                      )}
                      style={{ direction: 'rtl' }}
                      disabled={isLoading}
                    />
                  )}
                />
              </div>
              <div className="col-md-12 mb-4 text-end">
                <CustomButton 
                  background='rgb(0, 171, 85)' 
                  size="small"
                  disabled={isLoading}
                >
                  Add Activity
                </CustomButton>
              </div>
            </div>
          </form>
        </DialogContent>

        <DialogContent>
          <hr />

          <h5 className='mb-3'> Send Whatsup Message </h5>
          <textarea 
            style={{ height: '200px', direction: 'rtl' }} 
            placeholder='Message' 
            className='form-control mb-2' 
            defaultValue={whatsupMessage}
            value={whatsupMessage}
            onChange={(e) => setWhatsupMessage(e.target.value)}
          >
          </textarea>

          <div className="col-md-12 mb-4 text-end">
            <ButtonGroup variant="outlined" aria-label="outlined button group">
              {/* <Button onClick={() => this.setState({ whatsupMessage: warehouseDefaultMessage })}>وصلت مخزن</Button>
              <Button onClick={() => this.setState({ whatsupMessage: arrivedLibyaDefaultMessage })}>وصلت ليبيا</Button> */}
              <Button onClick={() => setWhatsupMessage('')}>حقل فارغ</Button>
            </ButtonGroup>
          </div>
                      
          <div className="col-md-12 mb-4 text-end">
            <CustomButton 
              background='rgb(0, 171, 85)' 
              size="small"
              disabled={isLoading}
              onClick={sendWhatsupMessage}
            >
              Send Message
            </CustomButton>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)} >الرجوع</Button>
        </DialogActions>
      </Dialog>

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
          open={isLoading}
        >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Grid>
  );
}

export default TransferOrdersList;
