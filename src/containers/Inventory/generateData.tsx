import { Avatar, AvatarGroup } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';

import moment from 'moment-timezone';
import MenuWrapper from "../../components/MenuWrapper/MenuWrapper";

export const defaultColumns: any = (setPreviewImages: any) => ([
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
        <div style={{ cursor: 'pointer' }} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'> 
          <MenuWrapper 
            options={[{ title: 'Edit', path: `/inventory/${params.row._id}/edit`, Icon: EditIcon, target: '_blank' }]}
          >
            <MoreVertIcon />
          </MenuWrapper>
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
    field: 'voyage',
    headerName: 'Voyage',
    width: 120,
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} </div>
    },
    align: 'center'
  },
  {
    field: 'shippingType',
    headerName: 'Shipping Method',
    width: 120,
    align: 'center'
  },
  {
    field: 'inventoryPlace',
    headerName: 'Office',
    width: 100,
    align: 'center'
  },
  {
    field: 'shippedCountry',
    headerName: 'Shipped From',
    width: 150,
    align: 'center'
  },
  {
    field: 'voyageAmount',
    headerName: 'Paid',
    width: 90,
    align: 'center'
  },
  {
    field: 'ordersCount',
    headerName: 'Orders',
    width: 120,
    align: 'center'
  },
  {
    field: 'note',
    headerName: 'Note',
    width: 300,
    align: 'center'
  },
  {
    field: 'createdAt',
    headerName: 'Created Date',
    width: 200,
    align: 'center'
  },
]);

export const generateDataToListType = (list: any[]) => {
  return list.map((data, i)=> ({
    id: i + 1,
    _id: data._id,
    voyage: data.voyage,
    attachments: data.attachments,
    inventoryPlace: data.inventoryPlace,
    note: data?.note,
    shippingType: data?.shippingType,
    shippedCountry: data.shippedCountry,
    voyageAmount: data.voyageAmount + ' ' + data.voyageCurrency,
    ordersCount: data?.orders?.length,
    createdAt: moment(data.createdAt).format('DD-MM-YYYY hh:mm A')
  }));
}
