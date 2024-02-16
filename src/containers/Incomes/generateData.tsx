import { Avatar, AvatarGroup } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';

import moment from 'moment-timezone';
import MenuWrapper from "../../components/MenuWrapper/MenuWrapper";

export const defaultColumns: any = (setState: any) => ([
  {
    field: 'id',
    headerName: 'Id',
    width: 60,
    align: 'center'
  },
  {
    field: 'images',
    headerName: 'Images',
    width: 130,
    renderCell: (params: GridRenderCellParams<any>) => {
      // if (!params.value.length) {
      //   return <div style={{ background: 'red', width: 60, height: 60 }}>

      //   </div>
      // }
      
      return <AvatarGroup style={{ cursor: 'pointer' }} onClick={() => setState({ selectedRowImages: params.value, openImagesModal: true })} max={3}>
        {params.value && params.value.map((image: any) => (
          <Avatar key={image._id} alt="" src={image.path} />
        ))}
    </AvatarGroup>
    }
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
    field: 'office',
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
  },
  {
    field: 'action',
    headerName: 'Action',
    width: 100,
    renderCell: (params: GridRenderCellParams<String>) => {
      
      return (
        <div style={{ cursor: 'pointer' }} className='MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-cell--editable'> 
          <MenuWrapper 
            options={[{ title: 'Edit', path: `/income/${params.row._id}/edit`, Icon: EditIcon }]}
          >
            <MoreVertIcon />
          </MenuWrapper>
        </div>
      )
    }
  }
]);

export const generateDataToListType = (list: any[]) => {
  return list.map((data, i)=> ({
    id: i + 1,
    _id: data._id,
    description: data.description,
    images: data.images,
    user: data.user?.firstName + ' ' + data.user?.lastName,
    office: data.office,
    cost: data.cost.total + ' ' + data.cost.currency,
    createdAt: moment(data.createdAt).format('DD-MM-YYYY hh:mm A')
  }));
}
