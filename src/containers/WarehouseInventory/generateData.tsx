import { Avatar, AvatarGroup } from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import moment from "moment-timezone";
import MenuWrapper from "../../components/MenuWrapper/MenuWrapper";

export const defaultColumns = (setState: any) => ([
  {
    headerName: 'Action',
    width: 100,
    renderCell: (params: GridRenderCellParams<String>) => {
      
      return (
        <div style={{ cursor: 'pointer' }} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'> 
          <MenuWrapper 
            options={[{ title: 'Edit', path: `/invoice/${params?.row?._id}/edit`, Icon: EditIcon, target: '_blank' }]}
          >
            <MoreVertIcon />
          </MenuWrapper>
        </div>
      )
    },
    disableExport: true
  },
  {
    field: 'id',
    headerName: 'Id',
    width: 60,
    align: 'center'
  },
  {
    field: 'invoiceImages',
    headerName: 'Admin Imgs',
    width: 140,
    disableExport: true,
    renderCell: (params: GridRenderCellParams<any>) => {
      const invImages = params.value.filter((img: any) => img.category === 'invoice');
      
      return <AvatarGroup style={{ cursor: 'pointer' }} onClick={() => setState(invImages)} max={3}>
        {invImages && invImages.map((image: any) => (
          <Avatar key={image._id} alt="" src={image.path} />
        ))}
    </AvatarGroup>
    }
  },
  {
    field: 'receiptsImages',
    headerName: 'Client Imgs',
    width: 140,
    disableExport: true,
    renderCell: (params: GridRenderCellParams<any>) => {
      const repImages = params.value.filter((img: any) => img.category === 'receipts');

      return <AvatarGroup style={{ cursor: 'pointer' }} onClick={() => setState(repImages)} max={3}>
        {repImages && repImages.map((image: any) => (
          <Avatar key={image._id} alt="" src={image.path} />
        ))}
    </AvatarGroup>
    }
  },
  {
    field: 'orderId',
    headerName: 'Order Id',
    width: 150,
    align: 'center'
  },
  {
    field: 'fullName',
    headerName: 'Full Name',
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'> {params.value} </div>
    },
    width: 200,
  },
  {
    field: 'trackingNumber',
    headerName: 'Tracking number',
    width: 170,
    align: 'center'
  },
  {
    field: 'receiptNo',
    headerName: 'Receipt No',
    width: 150,
    align: 'center'
  },
  {
    field: 'weight',
    headerName: 'CBM/KG',
    width: 150,
    align: 'center'
  },
  {
    field: 'totalInvoice',
    headerName: 'Total Invoice',
    width: 150,
    align: 'center'
  },
  {
    field: 'exiosShipmentPrice',
    headerName: 'Exios Price',
    width: 150,
    align: 'center'
  },
  {
    field: 'cost',
    headerName: 'Cost',
    width: 150,
    align: 'center'
  },
  {
    field: 'note',
    headerName: 'Delivery Place',
    width: 150,
    align: 'center'
  },
  {
    field: 'phone',
    headerName: 'Phone Number',
    type: 'number',
    width: 150,
    align: 'center',
  },
  {
    field: 'createdAt',
    headerName: 'Created Date',
    width: 200,
  }
]) as GridColDef[];

export const generateDataToListType = (list: any[]) => {
  return list.map((data: any, i)=> ({
    id: i + 1,
    _id: data._id,
    invoiceImages: data.images,
    receiptsImages: data.images,
    orderId: data.orderId,
    fullName: data.customerInfo.fullName,
    trackingNumber: data.paymentList.deliveredPackages.trackingNumber,
    phone: data.customerInfo.phone,
    receiptNo: data.paymentList.deliveredPackages.receiptNo,
    totalInvoice: `${data?.totalInvoice} $`,
    weight: `${data.paymentList?.deliveredPackages?.weight?.total || 0} ${data.paymentList.deliveredPackages?.weight?.measureUnit || ''}`,
    note: data.shipment.toWhere,
    exiosShipmentPrice: `${data.paymentList?.deliveredPackages?.exiosPrice} $`,
    cost: `${data.paymentList?.deliveredPackages?.exiosPrice * data.paymentList?.deliveredPackages?.weight?.total} $`,
    createdAt: moment(data.createdAt).format('DD-MM-YYYY hh:mm A'),
  }));
}
