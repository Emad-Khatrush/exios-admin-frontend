import { GridRenderCellParams } from "@mui/x-data-grid";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';

import moment from 'moment-timezone';
import MenuWrapper from "../../components/MenuWrapper/MenuWrapper";
import { Invoice } from "../../models";

export const defaultColumns: any = (setState: any) => ([
  {
    field: 'action',
    headerName: 'Action',
    width: 100,
    renderCell: (params: GridRenderCellParams<String>) => {
      
      return (
        <div style={{ cursor: 'pointer' }} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'> 
          <MenuWrapper 
            options={[{ title: 'Edit', path: `/invoice/${params.row._id}/edit`, Icon: EditIcon, target: '_blank' }]}
          >
            <MoreVertIcon />
          </MenuWrapper>
        </div>
      )
    }
  },
  {
    field: 'id',
    headerName: 'Id',
    width: 60,
    align: 'center'
  },
  {
    field: 'madyBy',
    headerName: 'Made By',
    width: 150,
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} </div>
    }
  },
  {
    field: 'orderId',
    headerName: 'Order Id',
    width: 120,
  },
  {
    field: 'customerName',
    headerName: 'Full Name',
    width: 200,
  },
  {
    field: 'trackingNumber',
    headerName: 'Tracking number',
    width: 250,
  },
  {
    field: 'destination',
    headerName: 'Destination',
    width: 200,
  },
  {
    field: 'weightKg',
    headerName: 'Weight KG',
    width: 140,
    align: 'center'
  },
  {
    field: 'weightCBM',
    headerName: 'Weight CBM',
    width: 140,
    align: 'center'
  },
  {
    field: 'receivedUSD',
    headerName: 'Received USD',
    width: 150,
    align: 'center',
    renderCell: (params: GridRenderCellParams<String>) => {
      const hasCustomerPaidShippingCost = calculateIfPackageHasPaid(params.row.order);
      const errorStyle = hasCustomerPaidShippingCost ? {} : {
        backgroundColor: '#ff9595' 
      }
      
      return <div style={{ ...errorStyle, fontWeight: '500', width: '100%' }} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} $</div>
    }
  },
  {
    field: 'receivedLYD',
    headerName: 'Received LYD',
    width: 150,
    align: 'center',
    renderCell: (params: GridRenderCellParams<String>) => {
      const hasCustomerPaidShippingCost = calculateIfPackageHasPaid(params.row.order);
      const errorStyle = hasCustomerPaidShippingCost ? {} : {
        backgroundColor: '#ff9595' 
      }
      
      return <div style={{ ...errorStyle, fontWeight: '500', width: '100%' }} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} LYD</div>
    }
  },
  {
    field: 'income',
    headerName: 'Income',
    width: 150,
    align: 'center',
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} $</div>
    }
  },
  {
    field: 'exiosPrice',
    headerName: 'Exios Price',
    width: 140,
    align: 'center'
  },
  {
    field: 'originPrice',
    headerName: 'Origin Price',
    width: 140,
    align: 'center'
  },
  {
    field: 'arrivedAt',
    headerName: 'Arrived At',
    width: 200,
  }
]);

export const generateDataToListType = (list: any[]) => {
  return list.map((data: Invoice | any , i)=> ({
    id: i + 1,
    _id: data._id,
    madyBy: `${data.madeBy?.firstName} ${data.madeBy?.lastName}`,
    orderId: data.orderId,
    customerName: data.customerInfo.fullName,
    destination: `${data.shipment.fromWhere} - ${data.shipment.toWhere}`,
    trackingNumber: data.paymentList.deliveredPackages.trackingNumber || '-',
    weightKg: data.paymentList.deliveredPackages?.weight?.measureUnit === 'KG' ? `${data.paymentList?.deliveredPackages?.weight?.total} KG` : '-',
    weightCBM: data.paymentList.deliveredPackages?.weight?.measureUnit === 'CBM' ? `${data.paymentList?.deliveredPackages?.weight?.total} CBM` : '-',
    arrivedAt: data.paymentList.status.arrived ? moment(data.paymentList.deliveredPackages?.arrivedAt).format('DD-MM-YYYY hh:mm A') : 'لم تصل بعد',
    receivedUSD: data.paymentList.deliveredPackages?.receivedShipmentUSD,
    receivedLYD: data.paymentList.deliveredPackages?.receivedShipmentLYD,
    income: calculateIncome(data.paymentList.deliveredPackages),
    exiosPrice: data.paymentList.deliveredPackages?.exiosPrice,
    originPrice: data.paymentList.deliveredPackages?.originPrice,
    order: data
  }));
}

const calculateIfPackageHasPaid = (order: Invoice | any) => {
  // check if the date of receivement deadline is missed
  const arrivedDate = new Date(order.paymentList.deliveredPackages?.arrivedAt);
  const nowDate = new Date();
  const differenceInTime  = nowDate.getTime() - arrivedDate.getTime();
  const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
  const isOrderByAir = order.shipment.method === 'air' ;
  
  const isDeadlineMissed = isOrderByAir
    ? differenceInDays > 25
    : differenceInDays > 65;

  const packageWeight = order.paymentList.deliveredPackages.weight.total;
  const exiosPrice = order.paymentList.deliveredPackages.exiosPrice;
  const payingCost = packageWeight * exiosPrice * 5;
  const hasCustomerPaidForShipping = payingCost <= (order.paymentList.deliveredPackages.receivedShipmentLYD + (order.paymentList.deliveredPackages.receivedShipmentUSD * 5));
  
  if (isDeadlineMissed) {
    if (!hasCustomerPaidForShipping) {
      return false
    }
  }
  return true;
}

const calculateIncome = (data: any) => {
  const exiosCost = data.exiosPrice * data.weight.total;
  const originCost = data.originPrice * data.weight.total;
  return exiosCost - originCost;
}