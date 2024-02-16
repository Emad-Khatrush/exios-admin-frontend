import React, { Component } from 'react'
import { Box, Breadcrumbs, Button, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, Link, TextField, Typography } from '@mui/material';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import { AiOutlineClear, AiOutlinePlus, AiOutlineSearch } from 'react-icons/ai'
import { GiTakeMyMoney } from 'react-icons/gi'
import Card from '../../components/Card/Card'
import CustomButton from '../../components/CustomButton/CustomButton'
import InfoTable from '../../components/InfoTable/InfoTable'
import InfoWidget from '../../components/InfoWidget/InfoWidget'
import TextInput from '../../components/TextInput/TextInput'
import DateRangePicker from '@mui/lab/DateRangePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { defaultColumns, generateDataToListType } from './generateData';
import moment from 'moment';
import SwipeableTextMobileStepper from '../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import withRouter from '../../utils/WithRouter/WithRouter';
import { Income } from '../../models';
import api from '../../api';

type Props = {
  router: any
}

type State = {
  searchValue: string
  dateFilterValue: any
  selectedRowImages: any
  openImagesModal: boolean
  listData: Income[]
  errors: any,
  isLoading: boolean
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Typography key="2" color='#28323C'>
    Incomes
  </Typography>,
];

class Incomes extends Component<Props, State> {
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
    this.getIncomes();
  }

  getIncomes = async () => {
    try {
      const incomes = await api.get('incomes');
      this.setState({ listData: incomes.data });
    } catch (error) {
      this.setState({ errors: error });
    } finally {
      const id = new URLSearchParams(this.props.router.location?.search).get('id') || '';
      this.setState({ searchValue: id, isLoading: false });
    }
  }

  getThisMonthData = (incomes: Income[]) => {
    const incomesInfo: any = [
      {
        office: 'Turkey',
        turkish: {
          currency: 'TRY',
          total: 0
        },
        american: {
          currency: 'USD',
          total: 0
        },
      },
      {
        office: 'Tripoli',
        american: {
          currency: 'USD',
          total: 0
        },
        libya: {
          currency: 'LYD',
          total: 0
        }
      },
      {
        office: 'Benghazi',
        american: {
          currency: 'USD',
          total: 0
        },
        libya: {
          currency: 'LYD',
          total: 0
        }
      }
    ]

    incomes.forEach((income: Income) => {
      const incomeDate = new Date(income.createdAt);
      const today = new Date();
      if (
        (incomeDate.getFullYear() === today.getFullYear()) &&
        (incomeDate.getMonth() === today.getMonth())
     ) {
        // return current month data
        if (income.office === 'turkey' && income.cost.currency === 'TRY') {
          incomesInfo[0].turkish.total += income.cost.total;
        } else if (income.office === 'tripoli') {
          if (income.cost.currency === 'USD') incomesInfo[1].american.total += income.cost.total;
          if (income.cost.currency === 'LYD') incomesInfo[1].libya.total += income.cost.total;
        } else if (income.office === 'benghazi') {
          if (income.cost.currency === 'USD') incomesInfo[2].american.total += income.cost.total;
          if (income.cost.currency === 'LYD') incomesInfo[2].libya.total += income.cost.total;
        }
     }
    });

    return incomesInfo;
  }

  filterList = (list: any[]) => {
    const { dateFilterValue }: any = this.state;

    let filteredList = list;

    if (dateFilterValue && dateFilterValue[0] && dateFilterValue[1]) {      
      filteredList = list.filter(a => {
        const dataDate = moment(a.createdAt);
        const startDate = moment(dateFilterValue[0]);
        const endDate = moment(dateFilterValue[1]);
        return startDate <= dataDate && dataDate <= endDate;
      })
    }

    return filteredList.filter(data => (
      (data.placedAt || "").toLocaleLowerCase().indexOf(this.state.searchValue.toLocaleLowerCase()) > -1 ||
      (data.user?.fullName || "").toLocaleLowerCase().indexOf(this.state.searchValue.toLocaleLowerCase()) > -1 ||
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

    const incomesInfo = this.getThisMonthData(listData)

    return (
      <div className="container mt-4">
        <div className="row" style={{ maxWidth: '1300px', margin: 'auto'}}>
            <div className="col-12"> 
              <h4 className='mb-2'> Incomes Table</h4>
              <div className='mb-4 d-flex justify-content-between'>
                  <Breadcrumbs separator="›" aria-label="breadcrumb">
                    {breadcrumbs}
                  </Breadcrumbs>

                <CustomButton 
                  background='rgb(0, 171, 85)' 
                  size="small" 
                  icon={<AiOutlinePlus />}
                  href={'/income/add'}
                >
                  Add Income
                </CustomButton>
              </div>
            </div>

            {incomesInfo.map((income: any) => (
              <div className="col-md-4">
                <InfoWidget key={income.office} title={`${income.office} Income`} value={income} icon={<GiTakeMyMoney />} />
              </div>
            ))}

            <div className="col-12">
              <Card>
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                  <TextInput 
                    placeholder="Search user or office..." 
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
                />
                
              </Card>
            </div>
          </div>
          <Dialog open={this.state.openImagesModal} onClose={() => this.setState({ openImagesModal: false })}>
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

export default withRouter(Incomes);
