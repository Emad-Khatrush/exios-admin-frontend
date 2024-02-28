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
import { Alert, Backdrop, CircularProgress, Dialog, Snackbar } from '@mui/material';
import { FaWarehouse, FaWhatsapp, FaWeight } from "react-icons/fa";
import * as XLSX from 'xlsx';
import moment from 'moment';
import { IoIosListBox } from 'react-icons/io';
import ActivityDialog from './ActivityDialog';
import EditPackageWeight from './EditPackageWeight';

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
  isSearching: boolean
}

const TransferOrdersList = (props: Props) => {
  const [checked, setChecked] = React.useState<readonly number[]>([]);
  const [left, setLeft] = React.useState<readonly number[]>([]);
  const [right, setRight] = React.useState<readonly number[]>([]);
  
  const [ showResponseMessage, setShowResponseMessage ] = React.useState<String | undefined>();
  const [ isSucceed, setIsSucceed ] = React.useState<boolean>(false);
  const [ isLoading, setLoading ] = React.useState(false);
  const [ component, setComponent ] = React.useState<any>();
  const [ showDialog, setShowDialog ] = React.useState(false);
  
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

  const handleDownload = () => {
    const data: any = [[moment(props.inventory.inventoryFinishedDate).format('DD/MM/YYYY'), '', '', props.inventory.shippedCountry, '', '', props.inventory.voyage, '', '', `${props.inventory.voyageAmount} ${props.inventory.voyageCurrency} تكلفة الرحلة:`], [], ['العدد', 'اسم الزبون', 'رمز العميل', 'كود تتبع Exios', 'رقم تتبع الصين', 'رقم تتبع المصدر', 'وزن/حجم', 'السعر المحسوب', 'تكلفة اكسيوس', 'موقعها', 'ملاحظات']];
    right.forEach((orderPackage: any, i) => {
      data.push([
        i + 1, 
        orderPackage.customerInfo.fullName,
        orderPackage.user.customerId,
        orderPackage.orderId,
        orderPackage.paymentList.deliveredPackages.trackingNumber, 
        orderPackage.paymentList.deliveredPackages.receiptNo,
        `${orderPackage.paymentList.deliveredPackages.weight.total} ${orderPackage.paymentList.deliveredPackages.weight.measureUnit}`,
        `${orderPackage.paymentList.deliveredPackages.exiosPrice} $`,
        `${Math.ceil(orderPackage.paymentList.deliveredPackages.exiosPrice * orderPackage.paymentList.deliveredPackages.weight.total)} $`,
        orderPackage.paymentList.deliveredPackages.locationPlace,
        orderPackage.shipment.toWhere
      ])
    })
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    // Merge cells A1 and B1
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, props.inventory.voyage);
    XLSX.writeFile(workbook, `${props.inventory.voyage}.xlsx`);
  };

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

  const addInventoryToWarehouse = async (office: string) => {
    try {
      const response = await api.get(`warehouse/${office}/goods`);
      const tripoliInventory = response.data[0];
      await api.update(`inventory/orders?id=${tripoliInventory?._id}`, rightChecked);
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
      window.location.reload();
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل الطلب، يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

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
          {props.isSearching ?
            <CircularProgress />
          :
          items.map((value: any) => {
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
                      <br />
                      {value?.paymentList?.deliveredPackages?.receiptNo && <Badge text={`Receipt number: ${value?.paymentList?.deliveredPackages?.receiptNo} `} /> }
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

  const customListForChosen = (title: React.ReactNode, items: readonly number[]) => {
    const filteredItems = items;

    return (
      <Card className='mt-2'>
        <button onClick={handleDownload}>Download Excel</button>
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
                      <p className='m-0 d-flex gap-2'>
                        <a style={{ textDecoration: 'none' }} className='m-0' href={`/invoice/${order?._id}/edit`} target='__blank'>
                          {order?.orderId}
                        </a>
                        <Badge text={`${order?.paymentList?.status?.arrivedLibya ? 'وصلت ليبيا' : 'لم تصل ليبيا'} `} />
                      </p>
                      <p className='m-0'>{`${order?.customerInfo?.fullName}`}</p>
                      <Badge text={`Tracking Number: ${order?.paymentList?.deliveredPackages?.trackingNumber} `} />
                      <br />
                      {order?.paymentList?.deliveredPackages?.receiptNo && <Badge text={`Receipt number: ${order?.paymentList?.deliveredPackages?.receiptNo} `} /> }
                      <div className='d-flex gap-3 mt-2 align-items-center'>
                        {!!order?.paymentList?.deliveredPackages?.weight?.total && <Badge text={`${order.paymentList.deliveredPackages.weight.total} ${order.paymentList.deliveredPackages.weight.measureUnit}`} />}
                        {order?.shipment?.fromWhere && <div><Badge text={`${order?.shipment?.toWhere}`} /></div>}
                        {order?.paymentList.deliveredPackages?.locationPlace && <Badge text={`${order?.paymentList.deliveredPackages?.locationPlace}`} />}
                      </div>
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

  const Tag = component === 'ActivityDialog' ? ActivityDialog : EditPackageWeight;

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
            color='success'
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
            color='error'
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
            onClick={() => {
              setComponent('ActivityDialog');
              setShowDialog(true);
            }}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            <FaWhatsapp />
          </Button>
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onClick={() => {
              setComponent('EditPackageWeight');
              setShowDialog(true);
            }}
            disabled={rightChecked.length !== 1}
            aria-label="move selected left"
          >
            <FaWeight />
          </Button> 
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onDoubleClick={() => addInventoryToWarehouse('tripoli')}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            <IoIosListBox /> Tripoli
          </Button>
          <Button
            sx={{ my: 0.5 }}
            variant="outlined"
            size="small"
            onDoubleClick={() => addInventoryToWarehouse('benghazi')}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            <IoIosListBox /> Benghazi
          </Button>
        </Grid>
      </Grid>

      <Grid item>{customListForChosen('Chosen', right)}</Grid>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} className='p-5' fullWidth>
        <Tag 
          checked={checked} 
          setShowDialog={setShowDialog}
          package={rightChecked[0]}
          inventory={props.inventory}
        />
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
