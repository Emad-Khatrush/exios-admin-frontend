import { AiOutlineSearch } from "react-icons/ai";
import CustomButton from "../../components/CustomButton/CustomButton";
import { Breadcrumbs, Button, CircularProgress, Dialog, DialogActions, DialogContent, Link, Typography } from '@mui/material';
import Card from "../../components/Card/Card";
import TextInput from "../../components/TextInput/TextInput";
import InfoTable from "../../components/InfoTable/InfoTable";
import { useEffect, useState } from "react";
import api from "../../api";
import { defaultColumns, generateDataToListType } from "./generateData";
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper";

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Inventory
  </Typography>,
];

const Inventory = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [inventories, setInventories] = useState([]);
  const [previewImages, setPreviewImages] = useState();
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    getAllInventory();
  }, [])

  const getAllInventory = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('inventory');
      setInventories(response.data);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  const filterList = (list: any[]) => {
    let filteredList = list;
    return filteredList.filter(data => (
      (data.voyage || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.inventoryPlace || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data.shippedCountry || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 ||
      (data?._id || "").toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase()) > -1 || 
      searchInsideOrders(data?.orders, searchValue)
    ))
  }

  const columns = [...defaultColumns(setPreviewImages)];
  const filteredList = generateDataToListType(filterList(inventories));

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <h4 className='mb-2'> Inventory Table</h4>
          <div className='mb-4 d-flex justify-content-between'>
            <Breadcrumbs separator="›" aria-label="breadcrumb">
              {breadcrumbs}
            </Breadcrumbs>

            <CustomButton 
              href="/inventory/add"
              background='rgb(0, 171, 85)' 
              size="small"
            >
            Add New Inventory
          </CustomButton>
          </div>
        </div>

        <div className="col-12">
          <Card>
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
              <TextInput 
                placeholder="Search for inventory" 
                icon={<AiOutlineSearch />}
                onChange={(event: any) => setSearchValue(event.target.value)}
              />
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
    </div>
  )
}

const searchInsideOrders = (orders: any = [], value: string) => {
  for (const order of orders) {
    if (
      (order?.paymentList?.deliveredPackages?.trackingNumber || "").toLocaleLowerCase().indexOf(value.toLocaleLowerCase()) > -1 ||
      (order?.orderId || "").toLocaleLowerCase().indexOf(value.toLocaleLowerCase()) > -1
    ) {
      return true;
    }
  }
  return false;
}

export default Inventory;
