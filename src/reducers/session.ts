import { CHECK_AUTH, LOGIN, STATUS_ERROR, STATUS_START, STATUS_SUCCESS } from "../constants/actions";
  
interface ISession {
  account: any
  token: string | null
  isError: boolean
  isLoggedIn: boolean
  isLoading: boolean
}

let user = null;
const token = localStorage.getItem('authToken');

if (localStorage.getItem('user')) {
  user = JSON.parse(localStorage.getItem('user') || '');
}

export const initialState: ISession = {
  account: user?.account || null,
  token: token || null,
  isError: false,
  isLoggedIn: (!!user?.account && !!token) || false,
  isLoading: false,
};


export const session = (state: ISession = initialState, action: any) => {  

  switch (action.type) {
    case LOGIN:
      switch (action.status) {
        case STATUS_START: {
          return {
            ...initialState,
            isLoading: true,
            isLoggedIn: false,
          };
        }
        
        case STATUS_SUCCESS: {     
          return {
            ...state,
            account: action.payload.account,
            token: action.payload.token,
            isError: false,
            isLoggedIn: true,
            isLoading: false,
          }
        }
        case STATUS_ERROR: {
          return {
            ...state,
            isError: true,
            isLoggedIn: false,
            isLoading: false,
            error: action.payload.error?.response?.data
          }
        }
      }
      break;
    case CHECK_AUTH:
      switch (action.status) {    
        case STATUS_SUCCESS: {
          return {
            ...state,
            token: action.payload.token,
            isError: false,
            isLoggedIn: true,
            isLoading: false,
          }
        }
        case STATUS_ERROR: {
          return {
            ...state,
            account: null,
            token: null,
            isError: true,
            isLoggedIn: false,
            isLoading: false,
            error: action.payload.error?.response?.data
          }
        }
      }
      break;
    default:
      return state;
  }
}
