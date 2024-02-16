import { CREATE_EXPENSE, GET_EXPENSES, RESET_EXPENSE, STATUS_ERROR, STATUS_START, STATUS_SUCCESS } from "../constants/actions";

export interface IStatus {
  isError: boolean
  isLoading: boolean
  isSuccess: boolean
  message: string | null
}

export interface IExpense{
  listStatus: IStatus
  list: any[]
  total: number
}

export const initialState: IExpense = {
  listStatus: {
    isError: false,
    isLoading: false,
    isSuccess: false,
    message: null
  },
  list: [],
  total: 0
};

export const expense = (state: IExpense = initialState, action: any) => {
  switch (action.type) {
    case RESET_EXPENSE:
      return initialState;

    case CREATE_EXPENSE:
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
              message: 'Expense has been created Successfully',
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
              message: action.payload.error
            }
          }
        }
      }
      break;

      case GET_EXPENSES: 
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
              },
              list: action.payload.data,
              total: action.payload?.data?.length
            }
          }
          case STATUS_ERROR: {
            return {
              ...state,
              listStatus: {
                isError: true,
                isSuccess: false,
                isLoading: false,
                message: action.payload.error.data.message
              }
            }
          }
        }
        break;
  
    default:
      return state;
  }
}