import { Avatar, AvatarGroup } from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import moment from "moment-timezone";
import MenuWrapper from "../../components/MenuWrapper/MenuWrapper";
import { Invoice } from "../../models";

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
      
      return <AvatarGroup style={{ cursor: 'pointer' }} onClick={() => setState({ selectedRowImages: invImages, openImagesModal: true })} max={3}>
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

      return <AvatarGroup style={{ cursor: 'pointer' }} onClick={() => setState({ selectedRowImages: repImages, openImagesModal: true })} max={3}>
        {repImages && repImages.map((image: any) => (
          <Avatar key={image._id} alt="" src={image.path} />
        ))}
    </AvatarGroup>
    }
  },
  {
    field: 'orderId',
    headerName: 'Tracking number',
    width: 150,
    align: 'center'
  },
  {
    field: 'user',
    headerName: 'Created By',
    width: 150,
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} </div>
    },
    
  },
  {
    field: 'fullName',
    headerName: 'Full Name',
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'> {params.value} </div>
    },
    width: 150,
  },
  {
    field: 'placedAt',
    headerName: 'Placed Office',
    width: 150,
  },
  {
    field: 'totalInvoice',
    headerName: 'Total Invoice',
    type: 'number',
    width: 150,
    align: 'center'
  },
  {
    field: 'receivedLYD',
    headerName: 'Received LYD',
    width: 180,
    align: 'center',
  },
  {
    field: 'receivedUSD',
    headerName: 'Received USD',
    width: 180,
    align: 'center',
  },
  {
    field: 'convertRate',
    headerName: 'Rate',
    width: 120,
    align: 'center',
  },
  {
    field: 'netIncome',
    headerName: 'Net Income',
    type: 'text',
    width: 130,
    align: 'center',
    renderCell: (params: GridRenderCellParams) => {
      return (
        <div 
          className="MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable"
        >
          {params.value} $
        </div>
      )
    },
  },
  {
    field: 'email',
    headerName: 'Email',
    width: 200,
    hide: true
  },
  {
    field: 'phone',
    headerName: 'Phone Number',
    type: 'number',
    width: 150,
    align: 'center',
  },
  {
    field: 'productName',
    headerName: 'Product Name',
    width: 150,
  },
  {
    field: 'quantity',
    headerName: 'Quantity',
    width: 120,
    align: 'center'
  },
  {
    field: 'debt',
    headerName: 'Debt',
    type: 'text',
    width: 120,
    align: 'center',
    valueFormatter: (params: any) => {
      return `${params.value?.total} ${params.value?.currency}`
    },
    renderCell: (params: GridRenderCellParams) => (
      <div 
          style={{ backgroundColor: `${params.value?.total < 0 || params.value?.total > 0 ? '#ff9595' : ''}`, width: '100%' }} 
          className="MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable"
        >
        {params.value?.total} {params.value?.currency}
      </div>
    )
  },
  {
    field: 'fromWhere',
    headerName: 'From Where',
    width: 150,
  },
  {
    field: 'toWhere',
    headerName: 'To Where',
    width: 150,
  },
  {
    field: 'method',
    headerName: 'Method',
    width: 100,
  },
  {
    field: 'exiosShipmentPrice',
    headerName: 'Exios Price',
    type: 'number',
    width: 150,
    align: 'center'
  },
  {
    field: 'originShipmentPrice',
    headerName: 'Origin Price',
    type: 'number',
    width: 150,
    align: 'center'
  },
  {
    field: 'shipmentIncome',
    headerName: 'Total Shipment Income',
    type: 'text',
    width: 200,
    align: 'center',
    valueFormatter: (params: any) => `${calculateShipmentIncome(params.value)}`,
    renderCell: (params: GridRenderCellParams) => {
      return (
        <div 
          className="MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable"
        >
          {calculateShipmentIncome(params.value)} $
        </div>
      )
    }
  },
  {
    field: 'madeBy',
    headerName: 'Made By',
    width: 200,
    align: 'center'
  },
  {
    field: 'paymentExistNote',
    headerName: 'Payment Exist ?',
    width: 200,
    align: 'center'
  },
  {
    field: 'orderNote',
    headerName: 'Note',
    width: 200,
    renderCell: (params: GridRenderCellParams) => (
      <div 
          style={{ backgroundColor: `${params.value ? '#bbffcf' : ''}`, width: '100%' }} 
          className="MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable"
        >
        {params.value}
      </div>
    )
  },
  {
    field: 'createdAt',
    headerName: 'Created Date',
    width: 200,
  }
]) as GridColDef[];

export const generateDataToListType = (list: any[]) => {
  return list.map((data: Invoice, i)=> ({
    id: i + 1,
    _id: data._id,
    invoiceImages: data.images,
    receiptsImages: data.images,
    orderId: data.orderId,
    user: data?.user?.firstName + ' ' + data?.user?.lastName,
    fullName: data.customerInfo.fullName,
    email: data.customerInfo.email,
    phone: data.customerInfo.phone,
    productName: data.productName,
    quantity: data.quantity,
    totalInvoice: `${data?.totalInvoice} $`,
    debt: data?.debt,
    netIncome: data?.netIncome[0]?.total,
    receivedLYD: `${data?.receivedLYD} LYD`,
    receivedUSD: `${data?.receivedUSD} USD`,
    convertRate: (data?.receivedLYD / data.totalInvoice).toFixed(2) || 0,
    orderNote: data.orderNote,
    fromWhere: data.shipment.fromWhere,
    toWhere: data.shipment.toWhere,
    method: data.shipment.method,
    originShipmentPrice: data.shipment.originShipmentPrice,
    exiosShipmentPrice: data.shipment.exiosShipmentPrice,
    shipmentIncome: data.paymentList,
    placedAt: data.placedAt,
    paymentExistNote: data.paymentExistNote,
    createdAt: moment(data.createdAt).format('DD-MM-YYYY hh:mm A'),
    madeBy: `${data?.madeBy?.firstName || ''} ${data?.madeBy?.lastName || ''}`
  }));
}

const calculateShipmentIncome = (list: any) => {
  let totalIncome = 0;
  list.forEach(({ deliveredPackages }: any): any => {
    const diffShipmentPrice = (deliveredPackages.exiosPrice - deliveredPackages.originPrice) || 0;
    totalIncome += deliveredPackages.weight.total * diffShipmentPrice;
  });
  return totalIncome;
}
