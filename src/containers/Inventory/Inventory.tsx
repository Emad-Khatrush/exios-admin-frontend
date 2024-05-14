import { AiOutlineSearch } from "react-icons/ai";
import CustomButton from "../../components/CustomButton/CustomButton";
import { Breadcrumbs, Button, CircularProgress, Dialog, DialogActions, DialogContent, Link, Typography } from '@mui/material';
import Card from "../../components/Card/Card";
import TextInput from "../../components/TextInput/TextInput";
import InfoTable from "../../components/InfoTable/InfoTable";
import { useEffect, useState } from "react";
import api, { base } from "../../api";
import { defaultColumns, generateDataToListType } from "./generateData";
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper";
import Badge from "../../components/Badge/Badge";

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
  const [isFetching, setIsFetching] = useState(false);
  const [inventories, setInventories] = useState<any>([]);
  const [previewImages, setPreviewImages] = useState();
  const [cancelToken, setCancelToken] = useState(null);
  const [searchValue, setSearchValue] = useState(null);
  const [lastMeta, setLastMeta] = useState<{ skip: string, limit: string, total: number }>({ skip: '0', limit: '10', total:  0});

  useEffect(() => {
    getAllInventory();
  }, [])

  useEffect(() => {
    
  }, [cancelToken])

  const getAllInventory = async () => {
    try {
      setIsLoading(true)
      const response = (await api.get('inventory', { skip: 0, limit: 10 }))?.data;
      setInventories(response.results);
      setLastMeta(response);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  const filterList = async (event: any) => {
    try {
      const searchValue = event.target.value;
      const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
      setCancelToken(cancelTokenSource);
      setSearchValue(searchValue);
      if (!searchValue) {
        getAllInventory();
        return;
      }

      const response = (await api.get('inventory', { skip: 0, limit: 10000, searchValue, cancelToken }))?.data;
      setInventories(response.results);
      setLastMeta(response);
    } catch (error) {
      console.log(error);
    } finally {
      setIsFetching(false);
    }
  }

  const fetchList = async () => {
    try {
      const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
      const { skip } = lastMeta;
      const response: any = (await api.get('inventory', { skip: Number(skip) + 10, limit: 10, cancelToken: cancelTokenSource }))?.data || [];
      setInventories((prev: any) => ([...prev, ...response.results]));
      setLastMeta(response);
    } catch (error) {
      console.log(error);
    }
  }

  const columns = [...defaultColumns(setPreviewImages)];
  const filteredList = generateDataToListType(inventories);

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
          <Card
            tabs={[
              {
                label: 'All',
                value: 'all',
                icon: <Badge style={{ marginLeft: '8px'}} text={String(lastMeta.total)} color="primary" />
              },
            ]}
          >
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
              <TextInput 
                placeholder="Search for inventory" 
                icon={<AiOutlineSearch />}
                onChange={(event: any) => {
                  setIsFetching(true);
                  filterList(event);
                }}
              />
            </div>
            {isLoading ?
              <CircularProgress />
              :
              <InfoTable
                columns={columns}
                data={filteredList}
                fetchList={!searchValue && fetchList}
                isLoading={isFetching}
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

export default Inventory;
