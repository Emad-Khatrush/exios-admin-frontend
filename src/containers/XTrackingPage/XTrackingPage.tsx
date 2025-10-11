import { Checkbox, CircularProgress } from "@mui/material";
import { Component } from "react";
import { AiOutlinePlus } from "react-icons/ai";
import { connect } from "react-redux";
import { getCurrentTabInvoices, getDefualtInvoices, getInvoices, getInvoicesBySearch } from "../../actions/invoices";
import Card from "../../components/Card/Card";
import CustomButton from "../../components/CustomButton/CustomButton";
import OrderWidget from "../../components/OrderWidget/OrderWidget";
import { LocalTabs } from "../../models";
import { IInvoice } from "../../reducers/invoices";
import { getTabOrdersCount } from "../../utils/methods";
import { generateTabs } from "./utils";
import { base } from "../../api";

type Props = {
  getInvoices: (config?: {
    skip?: number
    limit?: number
    tabType?: string
  }) => void
  getCurrentTabInvoices: (config?: {
    skip?: number
    limit?: number
    tabType?: string
  }) => void
  getDefualtInvoices: (config?: {
    skip?: number
    limit?: number
    tabType?: string
  }) => void
  getInvoicesBySearch: (query: { searchValue: string, selectorValue: string, tabType: string, cancelToken: any, hideFinishedOrdersCheck: boolean }) => void
  listData: IInvoice
}

type State = {
  searchValue: string
  selectorValue: string
  hideFinishedOrdersCheck: boolean
  scrollReached: boolean
  filteredOrders: IInvoice[]
  searchForOrder: boolean
  isTabOrdersLoading: boolean
  quickSearchDelayTimer: any
  cancelToken: any
}

const selectValues = [
  {
    label: 'Exios Id',
    value: 'orderId'
  },
  {
    label: 'Tracking Number',
    value: 'trackingNumber'
  },
  {
    label: 'Phone Number',
    value: 'phoneNumber'
  },
  {
    label: 'Receipt & Container',
    value: 'receiptAndContainer'
  },
]

class XTrackingPage extends Component<Props, State> {

  state: State = {
    searchValue: '',
    selectorValue: 'orderId',
    scrollReached: false,
    filteredOrders: [],
    searchForOrder: false,
    isTabOrdersLoading: false,
    quickSearchDelayTimer: undefined,
    cancelToken: null,
    hideFinishedOrdersCheck: false
  }

  componentDidMount() {
    this.props.getDefualtInvoices({
      skip: 0,
      limit: 10
    });
  }

  componentWillUnmount() {
    const { cancelToken } = this.state;
    if (cancelToken) {
      this.state.cancelToken?.cancel('Request canceled by user');
    }
  }

  onTabChange = (value: string) => {
    this.props.getCurrentTabInvoices({
      tabType: value,
      skip: 0,
      limit: 10
    });
  }

  onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollReached = event.currentTarget.scrollHeight - event.currentTarget.scrollTop <= event.currentTarget.clientHeight + 50;
    const limit = Number(this.props.listData?.query?.limit);
    const currentOrdersCount = getTabOrdersCount(this.props.listData.tabType, this.props.listData);
    
    if (scrollReached !== this.state.scrollReached && limit < currentOrdersCount) {
      this.props.getInvoices({
        skip: 0,
        limit: limit + 5,
        tabType: this.props.listData.tabType
      });
      this.setState({ scrollReached });
    }
  }

  filterList = (event: any) => {
    const eventName = event.target.name;
    const searchValue = eventName === 'searchValue' ? event.target.value : this.state.searchValue;
    const selectorValue = eventName === 'selectorValue' ? event.target.value : this.state.selectorValue;
    
    if (eventName === 'selectorValue' && searchValue === '') return;
    
    if (eventName === 'searchValue' && searchValue === '') {
      this.props.getInvoices({
        tabType: this.props.listData.tabType,
        skip: 0,
        limit: 10,
      });
    } else {      
      clearTimeout(this.state.quickSearchDelayTimer);
      this.setState(() => {
        return {
          quickSearchDelayTimer: setTimeout(async () => {
            this.props.getInvoicesBySearch({
              searchValue: searchValue,
              selectorValue: selectorValue,
              tabType: this.props.listData.tabType,
              cancelToken: this.state.cancelToken,
              hideFinishedOrdersCheck: this.state.hideFinishedOrdersCheck
            })
          }, 1)
        }
      })
    }
  }

  render() {
    const { listData } = this.props;    
    const { selectorValue, searchValue } = this.state;    
    const filteredList = listData.list.reverse();

    const tabs: LocalTabs = generateTabs({
      activeOrdersCount: listData.activeOrdersCount,
      shipmentOrdersCount: listData.shipmentOrdersCount,
      finishedOrdersCount: listData.finishedOrdersCount,
      unpaidOrdersCount: listData.unpaidOrdersCount,
      unsureOrdersCount: listData.unsureOrdersCount,
      arrivingOrdersCount: listData.arrivingOrdersCount,
      hasProblemOrdersCount: listData.hasProblemOrdersCount,
      hasRemainingPaymentOrdersCount: listData.hasRemainingPaymentOrdersCount,
    });

    const currentOrdersCount = getTabOrdersCount(this.props.listData.tabType, this.props.listData);    
    
    return (
      <div className="container mt-4">
        <div className="row">
          <div className="col-12 mb-4 text-end">
            <CustomButton
              background='rgb(0, 171, 85)' 
              size="small" 
              icon={<AiOutlinePlus />}
              href={'/unsureOrder/add'}
              style={{ marginRight: '10px' }}
            >
              Add unsure order
            </CustomButton>
          </div>
          <div className="col-md-12">
            <div>
              <Checkbox 
                name='Hide Finished Orders'
                onChange={(event: any) => { this.setState({ hideFinishedOrdersCheck: event.target.checked }) }} 
                color="success"
              />
              Hide Finished Orders
            </div>
            <Card
              tabs={tabs}
              showSearchInput={true}
              selectValues={selectValues}
              inputPlaceholder={'Search by User...'}
              bodyStyle={{
                height: '60vh',
                overflow: 'auto',
                marginTop: '20px'
              }}
              searchInputOnChange={(event: any) => {
                const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
                this.setState({ searchValue: event.target.value, cancelToken: cancelTokenSource });
                this.filterList(event);
              }}
              selectorInputOnChange={(event: any) => {
                this.setState({ selectorValue: event.target.value });
                this.filterList(event);
              }}
              tabsOnChange={(value: string) => this.onTabChange(value)}
              onScroll={this.onScroll}
            >
              {(listData.listStatus.isSwitchingTab) ?
                <div className="text-center">
                  <CircularProgress />
                </div>
                :
                <>
                  {filteredList && (filteredList || []).reverse().map((order: any, i: number) => (
                    <OrderWidget
                      key={order.orderId}
                      order={order}
                      orderIndex={currentOrdersCount - i}
                      isSearchingForTrackingNumber={selectorValue === 'trackingNumber' && searchValue !== ''}
                      currentTap={this.props.listData.tabType}
                    />
                  ))}
                </>
              }
  
              {listData.listStatus.isLoading &&
                <div className="text-center">
                  <CircularProgress />
                </div>
              }

              {filteredList?.length <= 0 && !listData.listStatus.isLoading &&
                <p className="text-center"> No orders found </p>
              }
            </Card>
          </div>
        </div>
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
    getInvoices,
    getInvoicesBySearch,
    getCurrentTabInvoices,
    getDefualtInvoices
};

export default connect(mapStateToProps, mapDispatchToProps)(XTrackingPage);
