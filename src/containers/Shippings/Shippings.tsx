import React, { Component } from 'react'
import { Box, Breadcrumbs, CircularProgress, IconButton, Link, TextField, Typography } from '@mui/material';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import { AiOutlineClear, AiOutlineSearch } from 'react-icons/ai'
import Card from '../../components/Card/Card'
import InfoTable from '../../components/InfoTable/InfoTable'
import TextInput from '../../components/TextInput/TextInput'
import DateRangePicker from '@mui/lab/DateRangePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { defaultColumns, generateDataToListType } from './generateData';
import moment from 'moment';
import withRouter from '../../utils/WithRouter/WithRouter';
import { Income } from '../../models';
import api from '../../api';

type Props = {
  router: any
}

type State = {
  searchValue: string
  dateFilterValue: any
  listData: Income[]
  errors: any,
  isLoading: boolean
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Shippings
  </Typography>,
];

class Shippings extends Component<Props, State> {
  state = {
    searchValue: '',
    dateFilterValue: null,
    selectedRowImages: null,
    openImagesModal: false,
    listData: [],
    errors: null,
    isLoading: false
  }

  componentDidMount() {
    this.setState({ isLoading: true });
    this.getPackages();
  }

  getPackages = async () => {
    try {
      const packages = await api.get('packages/orders');
      
      this.setState({ listData: packages.data });
    } catch (error) {
      this.setState({ errors: error });
    } finally {
      const id = new URLSearchParams(this.props.router.location?.search).get('id') || '';
      this.setState({ searchValue: id, isLoading: false });
    }
  }

  filterList = (list: any[]) => {
    const { dateFilterValue }: any = this.state;

    let filteredList = list;

    if (dateFilterValue && dateFilterValue[0] && dateFilterValue[1]) {     
      filteredList = list.filter(order => {
        const dataDate = moment(order.paymentList.deliveredPackages?.arrivedAt);
        const startDate = moment(dateFilterValue[0]);
        const endDate = moment(dateFilterValue[1]);
        return (startDate <= dataDate && dataDate <= endDate);
      })
    }

    return filteredList.filter(data => (
      (data.orderId || "").toLocaleLowerCase().indexOf(this.state.searchValue.toLocaleLowerCase()) > -1 ||
      (data?._id || "").toLocaleLowerCase().indexOf(this.state.searchValue.toLocaleLowerCase()) > -1
    ))
  }

  render() {
    const { listData, isLoading } = this.state;

    if (isLoading) {
      return <CircularProgress />;
    }

    const filteredList = generateDataToListType(this.filterList(listData));
    const columns = [...defaultColumns(this.setState.bind(this))];

    return (
      <div className="container mt-4">
        <div className="row" style={{ maxWidth: '1300px', margin: 'auto'}}>
            <div className="col-12"> 
              <h4 className='mb-2'>Shippings Table</h4>
              <div className='mb-4 d-flex justify-content-between'>
                <Breadcrumbs separator="›" aria-label="breadcrumb">
                  {breadcrumbs}
                </Breadcrumbs>
              </div>
            </div>

            <div className="col-12">
              <Card>
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                  <TextInput 
                    placeholder="Search by order id" 
                    icon={<AiOutlineSearch />}
                    onChange={(event: any) => this.setState({ searchValue: event.target.value })}
                  />
                  <div className='d-flex mt-2'>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DateRangePicker
                        startText="Start Date"
                        endText="End Date"
                        value={this.state.dateFilterValue || [null, null]}
                        onChange={(newValue) => this.setState({ dateFilterValue: newValue }) }
                        renderInput={(startProps, endProps) => (
                          <React.Fragment>
                            <TextField size='small' {...startProps} />
                            <Box sx={{ mx: 2 }}> to </Box>
                            <TextField size='small' {...endProps} />
                          </React.Fragment>
                        )}
                      />
                      </LocalizationProvider>
                      <IconButton color="primary" aria-label="Filter" onClick={() => this.setState({ dateFilterValue: null })}>
                        <AiOutlineClear
                          size={30} 
                          color={'rgb(99, 115, 129)'} 
                          title="filter" 
                          style={{ cursor: 'pointer'}}
                        />
                      </IconButton>
                  </div>
                </div>

                <InfoTable
                  columns={columns}
                  data={filteredList.reverse()}
                  fileName={'Exios-Shippings-' + moment(new Date()).format('MM-YYYY')}
                />
                
              </Card>
            </div>
          </div>
        </div>
    )
  }
}

export default withRouter(Shippings);
