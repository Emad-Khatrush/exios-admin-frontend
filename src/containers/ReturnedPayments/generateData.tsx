import { Avatar, AvatarGroup } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import moment from 'moment-timezone';
import { Package } from "../../models";
import { MdOutlineDoneOutline } from "react-icons/md";

export const defaultColumns: any = (setPreviewImages: any, setFinishPaymentDialog: any) => ([
  {
    field: 'id',
    headerName: 'Id',
    width: 60,
    align: 'center'
  },
  {
    field: 'action',
    headerName: 'Action',
    width: 100,
    renderCell: (params: GridRenderCellParams<String>) => {
      return (
        <div style={{ cursor: 'pointer' }} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'
          onClick={() => params.row.status === 'finished' ? undefined : setFinishPaymentDialog(params.row)}
        > 
          <MdOutlineDoneOutline color="green" style={{ border: '1px green solid' }} />
        </div>
      )
    },
    align: 'center'
  },
  {
    field: 'attachments',
    headerName: 'Images',
    width: 130,
    renderCell: (params: GridRenderCellParams<any>) => {
      return <AvatarGroup style={{ cursor: 'pointer' }} onClick={() => setPreviewImages(params.value)} max={3}>
        {params.value && params.value.map((image: any) => (
          <Avatar key={image._id} alt="" src={image.path} />
        ))}
    </AvatarGroup>
    }
  },
  {
    field: 'customerId',
    headerName: 'Customer Id',
    width: 150,
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} </div>
    },
    align: 'start'
  },
  {
    field: 'fullName',
    headerName: 'Full Name',
    width: 160,
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} </div>
    },
    align: 'start'
  },
  {
    field: 'amount',
    headerName: 'Amount',
    width: 120,
    align: 'center'
  },
  {
    field: 'paidAmount',
    headerName: 'Paid Amount',
    width: 150,
    align: 'center'
  },
  {
    field: 'orders',
    headerName: 'Tracking Numbers',
    width: 250,
  },
  {
    field: 'deliveryTo',
    headerName: 'Delivery To',
    width: 120,
    align: 'center'
  },
  {
    field: 'shippingCompanyName',
    headerName: 'Shipping Company',
    width: 180,
    align: 'center'
  },
  {
    field: 'shippingType',
    headerName: 'Shipping Method',
    width: 170,
    align: 'center'
  },
  {
    field: 'issuedOffice',
    headerName: 'Office',
    width: 100,
    align: 'center'
  },
  {
    field: 'note',
    headerName: 'Note',
    width: 300,
    align: 'start'
  },
  {
    field: 'found',
    headerName: 'Found',
    width: 150,
  },
  {
    field: 'paidDate',
    headerName: 'Paid Date',
    width: 200,
    align: 'center'
  },
  {
    field: 'goodsSentDate',
    headerName: 'Sent Date',
    width: 200,
    align: 'center'
  },
]);

export const generateDataToListType = (list: any[]) => {
  return list.map((data, i)=> ({
    id: i + 1,
    _id: data._id,
    customerId: data.customer.customerId,
    fullName: `${data.customer.firstName} ${data.customer.lastName}`,
    amount: `${data.amount} ${data.currency}`,
    paidAmount: `${data.paidAmount} ${data.paidAmountCurrency}`,
    attachments: data.attachments,
    deliveryTo: data.deliveryTo,
    note: data?.note,
    shippingType: data?.shippingType,
    shippingCompanyName: data.shippingCompanyName,
    issuedOffice: data.issuedOffice,
    goodsSentDate: moment(data.goodsSentDate).format('DD-MM-YYYY hh:mm A'),
    paidDate: moment(data.paidDate).format('DD-MM-YYYY hh:mm A'),
    orders: displayTrackingNumbers(data.orders),
    status: data.status,
    found: data?.paymentFound
  }));
}

const displayTrackingNumbers = (packages: Package[]) => {
  let label = '';
  packages.forEach((packageDetails: Package, i: number) => (
    label += `${i + 1}. ${packageDetails?.deliveredPackages?.trackingNumber}, `
  ))
  return label;
}
