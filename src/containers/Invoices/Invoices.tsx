import React, { Component } from 'react'
import { Box, Breadcrumbs, Button, Dialog, DialogActions, DialogContent, IconButton, Link, TextField, Typography } from '@mui/material';
import Card from '../../components/Card/Card'
import TextInput from '../../components/TextInput/TextInput'
import CustomButton from '../../components/CustomButton/CustomButton';

import { AiOutlineSearch, AiOutlinePlus, AiOutlineClear } from 'react-icons/ai';
import StatusDataWidget from '../../components/StatusDataWidget/StatusDataWidget';
import InfoTable from '../../components/InfoTable/InfoTable';
import { defaultColumns, generateDataToListType } from './generateData';
import { connect } from 'react-redux';
import { getAllInvoices, getInvoicesBySearch, fetchMoreInvoices } from '../../actions/invoices';
import { IInvoice } from '../../reducers/invoices';

import { FaFileInvoiceDollar } from 'react-icons/fa';
import { AiFillCheckCircle } from 'react-icons/ai';
import { IoIosTime } from 'react-icons/io';
import { GiShipBow } from 'react-icons/gi';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DateRangePicker from '@mui/lab/DateRangePicker';
import SwipeableTextMobileStepper from '../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import withRouter from '../../utils/WithRouter/WithRouter';
import Badge from '../../components/Badge/Badge';
import { Invoice, LocalTabs } from '../../models';
import { GridColDef } from '@mui/x-data-grid';
import { base } from '../../api';

interface InvoiceDetails {
  title: string,
  countInvoices: number,
  total: number
  color: string
  borderColor: string
  icon: React.ElementType
}

type Props = {
  getAllInvoices: (config?: { skip?: number, limit?: number, tabType?: string }) => void
  getInvoicesBySearch: (query: { searchValue: string, dateValue: any, selectorValue: string, tabType: string, cancelToken: any }) => void
  fetchMoreInvoices: (config?: { skip?: number, limit?: number, tabType?: string, cancelToken?: any }) => void
  listData: IInvoice
  router: any
}

type State = {
  searchValue: string
  dateFilterValue: any
  selectedRowImages: any
  openImagesModal: boolean
  activeTabValue: string
  cancelToken: any
  quickSearchDelayTimer: any
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Invoices
  </Typography>,
];

class Invoices extends Component<Props, State> {
  state: State = {
    searchValue: '',
    activeTabValue: 'all',
    dateFilterValue: null,
    selectedRowImages: null,
    openImagesModal: false,
    quickSearchDelayTimer: null,
    cancelToken: null
  }

  componentDidMount() {
    const id = new URLSearchParams(this.props.router.location?.search).get('id') || '';
    if (id) {
      const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
      this.setState({ searchValue: id, cancelToken: cancelTokenSource });
      this.filterList({
        target: {
          name: 'searchInput',
          value: id
        }
      });
    } else {
      this.props.getAllInvoices({ skip: 0, limit: 15 });
    }
  }

  componentWillUnmount() {
    const { cancelToken } = this.state;
    if (cancelToken) {
      this.state.cancelToken?.cancel('Request canceled by user');
    }
  }

  findOrdersForSelectedTab = (order: Invoice) => {
    const { activeTabValue } = this.state;

    switch (activeTabValue) {
      case 'all':
        // display all active orders
        return !order.unsureOrder;
      
      case 'shipment':
      // display shipment orders only
      return order.isShipment && !order.isPayment && !order.unsureOrder && !order.isFinished;

      case 'paid':
      // display paid orders only
      return !order.isShipment && order.isPayment && !order.unsureOrder && !order.isFinished;

      case 'finished':
      // display finished orders only      
      return order.isFinished;

      case 'unsure':
      // display unsure orders only
      return order.unsureOrder && !order.isFinished;
    
      default:
        // default
        return !order.isFinished && !order.unsureOrder;
    }
  }

  filterList = (event: any) => {
    const eventName = event?.target?.name;
    const searchValue = eventName === 'searchInput' ? event.target.value : this.state.searchValue;
    const dateValue = eventName !== 'searchInput' ? event : this.state.dateFilterValue;
    
    if (eventName !== 'searchInput' && (!dateValue || !!!dateValue[0] || !!!dateValue[1])) return;

    if (eventName === 'searchInput' && searchValue === '' && (!dateValue || !!!dateValue[0] || !!!dateValue[1])) {
      return this.props.getAllInvoices({ skip: 0, limit: 15 });
    }

    clearTimeout(this.state.quickSearchDelayTimer);
    this.setState(() => {
      return {
        quickSearchDelayTimer: setTimeout(() => {
          this.props.getInvoicesBySearch({
            searchValue: searchValue,
            dateValue: dateValue,
            selectorValue: 'createdAtDate',
            tabType: 'active',
            cancelToken: this.state.cancelToken
          })
        }, 1)
      }
    })
  }

  fetchList = async () => {
    const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
    const { skip } = this.props.listData.query;
    this.props.fetchMoreInvoices({ skip: skip + 15, limit: 15, cancelToken: cancelTokenSource });
  }

  getIvoicesDetails = (list: any[]) => {
    const totalInvoices: InvoiceDetails = { title: 'Total', total: 0, countInvoices: 0, color: '#2596FF', borderColor: '#9DCDF9', icon: FaFileInvoiceDollar };
    const paidInvoices: InvoiceDetails = { title: 'Paid', total: 0, countInvoices: 0, color: '#36d600', borderColor: '#2eb8004c', icon: AiFillCheckCircle };
    const debtInvoices: InvoiceDetails = { title: 'Debt', total: 0, countInvoices: 0, color: '#f0cc00', borderColor: 'rgba(245, 208, 0, 0.3)', icon: IoIosTime };
    const shipmentInvoices: InvoiceDetails = { title: 'Shipment', total: 0, countInvoices: 0, color: '#2c2ff8', borderColor: '#8c8eff', icon: GiShipBow };
    const canceledInvoices: InvoiceDetails = { title: 'Canceled', total: 0, countInvoices: 0, color: '#ff4646', borderColor: '#fc9393', icon: FaFileInvoiceDollar };

    list.forEach((data: Invoice) => {
      if(data.isPayment) {        
        paidInvoices.total += data.totalInvoice;
        paidInvoices.countInvoices = paidInvoices.countInvoices + 1;
      }
      if(data.isShipment) {        
        shipmentInvoices.total += data.totalInvoice;
        shipmentInvoices.countInvoices = shipmentInvoices.countInvoices + 1;
      }
      if(data.debt?.total > 0 && data.debt?.currency === 'USD') {        
        debtInvoices.total += data.debt.total;
        debtInvoices.countInvoices = debtInvoices.countInvoices + 1;
      }
      if(data.isCanceled) {        
        canceledInvoices.total += data.totalInvoice;
        canceledInvoices.countInvoices = canceledInvoices.countInvoices + 1;
      }
      if (!data.unsureOrder) {
        totalInvoices.total += data.totalInvoice;
        totalInvoices.countInvoices = totalInvoices.countInvoices + 1;
      }
    })
    return [
      totalInvoices,
      shipmentInvoices,
      paidInvoices,
      debtInvoices,
      canceledInvoices
    ]
  }

  render() {
    const { listData } = this.props;

    const filteredList = generateDataToListType(listData.list);
    const invoicesDetails = this.getIvoicesDetails(listData.list);

    const columns: GridColDef[] = [...defaultColumns(this.setState.bind(this))] as any;

    const tabs: LocalTabs = [
      {
        label: 'All',
        value: 'all',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(listData.total)} color="sky" />
      },
      // {
      //   label: 'Shipment',
      //   value: 'shipment',
      //   icon: <Badge style={{ marginLeft: '8px'}} text={String(shipmentOrderCount)} color="primary" />
      // },
      // {
      //   label: 'Paid',
      //   value: 'paid',
      //   icon: <Badge style={{ marginLeft: '8px'}} text={String(paidOrderCount)} color="warning" />
      // },
      // {
      //   label: 'Finished',
      //   value: 'finished',
      //   icon: <Badge style={{ marginLeft: '8px'}} text={String(finishedOrderCount)} color="success" />
      // },
      // {
      //   label: 'Unsure Orders',
      //   value: 'unsure',
      //   icon: <Badge style={{ marginLeft: '8px'}} text={String(unsureOrderCount)} color="danger" />
      // }
    ]
    
    return (
      <div className="container mt-4">
        <div className="row" style={{ maxWidth: '1300px', margin: 'auto'}}>
          <div className="col-12">
            <h4 className='mb-2'> Invoices Table</h4>
            <div className='mb-4 d-flex flex-column flex-lg-row justify-content-between'>
              <Breadcrumbs separator="›" aria-label="breadcrumb">
                {breadcrumbs}
              </Breadcrumbs>
              <div className='mt-3'>
                <CustomButton
                  background='rgb(0, 171, 85)' 
                  size="small" 
                  icon={<AiOutlinePlus />}
                  href={'/unsureOrder/add'}
                  style={{ marginRight: '10px' }}
                >
                  Add unsure order
                </CustomButton>

                <CustomButton 
                  background='rgb(0, 171, 85)' 
                  size="small" 
                  icon={<AiOutlinePlus />}
                  href={'/invoice/add'}
                >
                  Add Invoice
                </CustomButton>
              </div>
            </div>

            <StatusDataWidget 
              invoicesDetails={invoicesDetails}
              isLoading={listData.listStatus.isLoading || listData.listStatus.isSwitchingTab}
            />

            <Card
              tabs={tabs}
              tabsOnChange={(value: string) => this.setState({ activeTabValue: value })}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                <TextInput
                  name='searchInput'
                  placeholder="Search User..." 
                  icon={<AiOutlineSearch />} 
                  value={this.state.searchValue}
                  onChange={(event: any) => {
                    const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
                    this.setState({ searchValue: event.target.value, cancelToken: cancelTokenSource });
                    this.filterList(event);
                  }}
                />
                <div className='d-flex mt-2'>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateRangePicker
                      startText="Start Date"
                      endText="End Date"
                      value={this.state.dateFilterValue || [null, null]}
                      onChange={(newValue) => {
                        const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
                        this.setState({ dateFilterValue: newValue, cancelToken: cancelTokenSource });
                        this.filterList(newValue);
                      }}
                      renderInput={(startProps, endProps) => (
                        <React.Fragment>
                          <TextField size='small' {...startProps} />
                          <Box sx={{ mx: 2 }}> to </Box>
                          <TextField size='small' {...endProps} />
                        </React.Fragment>
                      )}
                    />
                    </LocalizationProvider>
                    <IconButton 
                      color="primary" 
                      aria-label="Filter" 
                      onClick={async () => {
                        this.setState({ dateFilterValue: null, searchValue: '' });
                        this.props.getAllInvoices({ skip: 0, limit: 15 });
                      }}
                    >
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
                data={filteredList}
                isLoading={listData && (listData.listStatus.isLoading || listData.listStatus.isSwitchingTab)}
                fetchList={this.fetchList}
              />
              
            </Card>
          </div>
        </div>
        <Dialog 
          open={this.state.openImagesModal}
          onClose={() => this.setState({ openImagesModal: false })}
        >
          <DialogContent>
            <SwipeableTextMobileStepper data={this.state.selectedRowImages} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ openImagesModal: false })} >Close</Button>
          </DialogActions>
        </Dialog>
      </div>
    )
  }
}

const mapStateToProps = (state: any) => {
	return {
		listData: state.invoice,
	};
}

const mapDispatchToProps = {
  getAllInvoices,
  getInvoicesBySearch,
  fetchMoreInvoices
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Invoices));
