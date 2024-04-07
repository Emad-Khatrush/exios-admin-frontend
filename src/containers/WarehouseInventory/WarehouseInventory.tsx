import { AiOutlineSearch } from "react-icons/ai";
import { Breadcrumbs, Button, CircularProgress, Dialog, DialogActions, DialogContent, Link, Typography } from '@mui/material';
import Card from "../../components/Card/Card";
import TextInput from "../../components/TextInput/TextInput";
import InfoTable from "../../components/InfoTable/InfoTable";
import { useEffect, useState } from "react";
import api from "../../api";
import { defaultColumns, generateDataToListType } from "./generateData";
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper";
import { LocalTabs } from "../../models";
import Badge from "../../components/Badge/Badge";
import ActivityDialog from "../../components/TransferOrdersList/ActivityDialog";
import CustomButton from "../../components/CustomButton/CustomButton";

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Warehouse Inventory
  </Typography>,
];

const WarehouseInventory = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState<any>([]);
  const [previewImages, setPreviewImages] = useState();
  const [searchValue, setSearchValue] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    getAllInventory();
  }, [])

  const getAllInventory = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('warehouse/tripoli/goods');
      setOrders(response.data[0]?.orders || []);
      setInventory(response.data[0] || [])
    } catch (error) {
      setOrders([])
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  const filterList = (list: any[]) => {
    let filteredList = list;
    
    return filteredList.filter(data => (
      (data.customerInfo.fullName || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.orderId || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data?.user?.customerId || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.paymentList.deliveredPackages.trackingNumber || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.paymentList.deliveredPackages.receiptNo || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1
    ))
  }

  const onTabChange = async (value: any) => {
    try {
      setIsLoading(true)
      const response = await api.get(`warehouse/${value}/goods`);
      setOrders(response.data[0]?.orders || []);
    } catch (error) {
      setOrders([])
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [...defaultColumns(setPreviewImages)];
  const filteredList = generateDataToListType(filterList(orders));

  const tabs: LocalTabs = [
    {
      label: 'Tripoli',
      value: 'tripoli',
      icon: <Badge style={{ marginLeft: '8px'}} text={'1'} color="sky" />
    },
    {
      label: 'Benghazi',
      value: 'benghazi',
      icon: <Badge style={{ marginLeft: '8px'}} text={'1'} color="sky" />
    }
  ]

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <h4 className='mb-2'> Warehouse Table</h4>
          <div className='mb-4 d-flex justify-content-between'>
            <Breadcrumbs separator="›" aria-label="breadcrumb">
              {breadcrumbs}
            </Breadcrumbs>
          </div>
        </div>

        <div className="col-12">
          <Card
            tabs={tabs}
            tabsOnChange={(value: string) => onTabChange(value)}
          >
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
              <TextInput 
                placeholder="Search for goods" 
                icon={<AiOutlineSearch />}
                onChange={(event: any) => setSearchValue(event.target.value)}
              />
              <CustomButton 
                background='rgb(0, 171, 85)' 
                size="small"
                disabled={isLoading}
                onClick={() => setShowDialog(true)}
              >
                Send Whatsup messages
              </CustomButton>
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

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} className='p-5' fullWidth>
        <ActivityDialog 
          checked={orders} 
          setShowDialog={setShowDialog}
          inventory={inventory}
        />
      </Dialog>
    </div>
  )
}

export default WarehouseInventory;
