import { GridRenderCellParams } from "@mui/x-data-grid";
import moment from 'moment-timezone';

export const defaultColumns: any = () => ([
  {
    field: 'id',
    headerName: 'Id',
    width: 60,
    align: 'center'
  },
  {
    field: 'user',
    headerName: 'Created By',
    width: 150,
    renderCell: (params: GridRenderCellParams<String>) => {
      return <div style={{fontWeight: '500'}} className='MuiDataGrid-cell MuiDataGrid-cell--editable'> {params.value} </div>
    }
  },
  {
    field: 'placedAt',
    headerName: 'Office',
    width: 120,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 300,
  },
  {
    field: 'cost',
    headerName: 'Cost',
    width: 120,
    align: 'center'
  },
  {
    field: 'createdAt',
    headerName: 'Created Date',
    width: 200,
  }
]);

export const generateDataToListType = (list: any[]) => {
  return list.map((data, i)=> ({
    id: i + 1,
    _id: data._id,
    description: data.description,
    user: data.user?.firstName + ' ' + data.user?.lastName,
    placedAt: data.placedAt,
    cost: data.cost.total + ' ' + data.cost.currency,
    createdAt: moment(data.createdAt).format('DD-MM-YYYY hh:mm A')
  }));
}
