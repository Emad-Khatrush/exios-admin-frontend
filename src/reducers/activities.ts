import { GET_ACTIVITIES, STATUS_ERROR, STATUS_LOADING, STATUS_START, STATUS_SUCCESS } from "../constants/actions";
import { IStatus } from "./expenses";

export interface IActivities{
  listStatus: IStatus
  list: any[]
  total: number
  query: {
    limit: number
    skip: number
  }
}

export const initialState: IActivities = {
  listStatus: {
    isError: false,
    isLoading: false,
    isSuccess: false,
    message: null
  },
  list: [],
  total: 0,
  query: {
    limit: 0,
    skip: 0
  }
};

export const activity = (state: IActivities = initialState, action: any) => {
  switch (action.type) {
    case GET_ACTIVITIES:
      switch (action.status) {
        case STATUS_START: {
          return {
            ...initialState,
            listStatus: {
              isLoading: true
            }
          };
        }

        case STATUS_LOADING: {
          return {
            ...state,
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
            list: action.payload.data?.activities,
            total: action.payload?.data?.total,
            query: {
              limit: action.payload?.data?.limit,
              skip: action.payload?.data?.skip
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