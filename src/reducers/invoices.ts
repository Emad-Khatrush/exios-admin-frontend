import { CLEAR_LIST, CREATE_INVOICE, GET_INVOICES, RESET_INVOICE, STATUS_ERROR, STATUS_LOADING, STATUS_START, STATUS_SUCCESS, SWITCH_TAB } from "../constants/actions";
import { Invoice } from "../models";

export interface IStatus {
  isError: boolean
  isLoading: boolean
  isSuccess: boolean
  isSwitchingTab: boolean
  message: string | null
}

export interface IInvoice{
  listStatus: IStatus
  list: Invoice[]
  query: {
    skip: number
    limit: number
  }
  total: number
  activeOrdersCount: number
  shipmentOrdersCount: number
  finishedOrdersCount: number
  unpaidOrdersCount: number
  unsureOrdersCount: number
  arrivingOrdersCount: number
  tabType: string
}

export const initialState: IInvoice = {
  listStatus: {
    isError: false,
    isLoading: false,
    isSuccess: false,
    isSwitchingTab: false,
    message: null
  },
  list: [],
  query: {
    limit: 0,
    skip: 0
  },
  total: 0,
  activeOrdersCount: 0,
  shipmentOrdersCount: 0,
  finishedOrdersCount: 0,
  unpaidOrdersCount: 0,
  unsureOrdersCount: 0,
  arrivingOrdersCount: 0,
  tabType: 'active' 
}

export const invoice = (state: IInvoice = initialState, action: any) => {
  switch (action.type) {
    case RESET_INVOICE:
      return initialState;

    case CREATE_INVOICE:
      switch (action.status) {
        case STATUS_START: {
          return {
            ...initialState,
            listStatus: {
              isLoading: true
            }
          };
        }
        
        case STATUS_SUCCESS: {          
          return {
            ...state,
            listStatus: {
              isError: false,
              isSuccess: true,
              isLoading: false,
              message: 'Invoice has been created Successfully',
            }
          }
        }
        case STATUS_ERROR: {
          return {
            ...state,
            listStatus: {
              isError: true,
              isSuccess: false,
              isLoading: false,
              message: action.payload.error?.data?.message
            }
          }
        }
      }
      break;

      case GET_INVOICES: 
        switch (action.status) {
          case STATUS_START: {
            return {
              ...initialState,
              listStatus: {
                isSwitchingTab: true
              }
            };
          }

          case SWITCH_TAB: {
            return {
              ...state,
              listStatus: {
                isError: false,
                isSuccess: false,
                isLoading: false,
                isSwitchingTab: true
              }
            };
          }

          case CLEAR_LIST: {
            return {
              ...initialState,
              list: [],
            };
          }

          case STATUS_LOADING: {
            return {
              ...state,
              listStatus: {
                isError: false,
                isSuccess: false,
                isLoading: true,
                isSwitchingTab: false
              }
            };
          }
          
          case STATUS_SUCCESS: {
            let orders = action.payload.data.orders;
            if (action.payload.pushNewDataToList) {
              orders = state.list || [];
              orders.push(...action.payload.data.orders)
            }
            
            if (action.payload?.dontUpdateOrdersCount) {
              return {
                ...state,
                listStatus: {
                  isError: false,
                  isSuccess: true,
                  isLoading: false,
                  isSwitchingTab: false
                },
                list: orders,
                tabType: action.payload?.data?.tabType,
                total: action.payload?.data?.total,
                query: action.payload?.data?.query
              }
            }
            return {
              ...state,
              listStatus: {
                isError: false,
                isSuccess: true,
                isLoading: false,
                isSwitchingTab: false
              },
              list: orders,
              activeOrdersCount: action.payload?.data?.activeOrdersCount,
              shipmentOrdersCount: action.payload?.data?.shipmentOrdersCount,
              finishedOrdersCount: action.payload?.data?.finishedOrdersCount,
              unpaidOrdersCount: action.payload?.data?.unpaidOrdersCount,
              unsureOrdersCount: action.payload?.data?.unsureOrdersCount,
              arrivingOrdersCount: action.payload?.data?.arrivingOrdersCount,
              tabType: action.payload?.data?.tabType,
              total: action.payload?.data?.total,
              query: action.payload?.data?.query
            }
          }
          case STATUS_ERROR: {
            return {
              ...state,
              listStatus: {
                isError: true,
                isSuccess: false,
                isLoading: false,
                isSwitchingTab: false,
                message: action.payload.error?.data?.message
              }
            }
          }
        }
        break;
  
    default:
      return state;
  }
}