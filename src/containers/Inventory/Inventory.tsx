import { AiOutlineSearch } from "react-icons/ai";
import CustomButton from "../../components/CustomButton/CustomButton";
import {
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Link,
  Typography,
  Tabs,
  Tab,
  Box
} from '@mui/material';
import Card from "../../components/Card/Card";
import TextInput from "../../components/TextInput/TextInput";
import InfoTable from "../../components/InfoTable/InfoTable";
import { useEffect, useState } from "react";
import api, { base } from "../../api";
import { defaultColumns, generateDataToListType } from "./generateData";
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper";
import Badge from "../../components/Badge/Badge";
import { useSelector } from "react-redux";
import FlightsManagement from "./FlightsManagement";

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Inventory
  </Typography>,
];

const Inventory = () => {
  const [quickSearchDelayTimer, setQuickSearchDelayTimer] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [inventories, setInventories] = useState<any>([]);
  const [previewImages, setPreviewImages] = useState();
  const [cancelToken, setCancelToken] = useState(null);
  const [searchValue, setSearchValue] = useState(null);
  const [searchType, setSearchType] = useState('all');
  const [lastMeta, setLastMeta] = useState<{ skip: string, limit: string, total: number, countList: any }>({ skip: '0', limit: '10', total: 0, countList: null });

  const [tabIndex, setTabIndex] = useState<number>(0); // Tab state

  const { roles } = useSelector((state: any) => state.session.account);
  

  useEffect(() => {
    getAllInventory();
  }, [])

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

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
      setIsLoading(true);
      const searchValue = event.target.value;
      setSearchValue(searchValue);

      if (!searchValue) {
        getAllInventory();
        return;
      }

      clearTimeout(quickSearchDelayTimer);
      setQuickSearchDelayTimer((): any => {
        return setTimeout(async () => {
          const response = (await api.get('inventory', { skip: 0, limit: 10000, searchValue, cancelToken }))?.data;
          setInventories(response.results);
          setLastMeta(response);
          setIsLoading(false);
        }, 1)
      })
    } catch (error) {
      console.log(error);
      setIsLoading(false);
    }
  }

  const fetchList = async () => {
    if (searchValue) return;

    try {
      setIsFetching(true);
      const cancelTokenSource: any = base.cancelRequests();
      const { skip } = lastMeta;

      clearTimeout(quickSearchDelayTimer);
      setQuickSearchDelayTimer((): any => {
        return setTimeout(async () => {
          const response: any = (await api.get('inventory', { skip: Number(skip) + 10, limit: 10, cancelToken: cancelTokenSource, searchType }))?.data || [];
          setInventories((prev: any) => ([...prev, ...response.results]));
          setLastMeta(response);
          setIsFetching(false);
        }, 1)
      })
    } catch (error) {
      console.log(error);
      setIsFetching(false);
    }
  }

  const onTabChange = async (value: string) => {
    try {
      setIsLoading(true);
      const cancelTokenSource: any = base.cancelRequests();

      clearTimeout(quickSearchDelayTimer);
      setQuickSearchDelayTimer((): any => {
        return setTimeout(async () => {
          const response: any = (await api.get('inventory', { skip: 0, limit: 10, searchType: value, cancelToken: cancelTokenSource }))?.data || [];
          setInventories(() => ([...response.results]));
          setLastMeta(response);
          setSearchType(value);
          setIsLoading(false);
        }, 1)
      })
    } catch (error) {
      console.log(error);
      setIsLoading(false);
    }
  }

  const columns = [...defaultColumns(setPreviewImages)];
  const filteredList = generateDataToListType(inventories);

  return (
    <div className="container mt-4">
      {roles.isAdmin && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabIndex} onChange={handleTabChange} aria-label="Inventory Tabs">
            <Tab label="Inventory Table" />
            <Tab label="flights Management" />
          </Tabs>
        </Box>
      )}

      {/* Inventory Table Page */}
      {tabIndex === 0 && (
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
                  icon: <Badge style={{ marginLeft: '8px' }} text={String(lastMeta.countList?.all || 0)} color="primary" />
                },
                {
                  label: 'Air Flights',
                  value: 'air',
                  icon: <Badge style={{ marginLeft: '8px' }} text={String(lastMeta.countList?.air || 0)} color="warning" />
                },
                {
                  label: 'Sea Flights',
                  value: 'sea',
                  icon: <Badge style={{ marginLeft: '8px' }} text={String(lastMeta.countList?.sea || 0)} color="warning" />
                },
                {
                  label: 'Domestic',
                  value: 'domestic',
                  icon: <Badge style={{ marginLeft: '8px' }} text={String(lastMeta.countList?.domestic || 0)} color="warning" />
                },
                {
                  label: 'Finished Flights',
                  value: 'finished',
                  icon: <Badge style={{ marginLeft: '8px' }} text={String(lastMeta.countList?.finished || 0)} color="success" />
                },
              ]}
              tabsOnChange={onTabChange}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                <TextInput
                  placeholder="Search for inventory"
                  icon={<AiOutlineSearch />}
                  onChange={(event: any) => {
                    const cancelTokenSource: any = base.cancelRequests();
                    setCancelToken(cancelTokenSource);
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
                  fetchList={fetchList}
                  isLoading={isFetching}
                />
              }
            </Card>
          </div>
        </div>
      )}

      {tabIndex === 1 && (
        <div className="row">
          <div className="col-12">
            <FlightsManagement />
          </div>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImages} onClose={() => setPreviewImages(undefined)}>
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)} >Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Inventory;
