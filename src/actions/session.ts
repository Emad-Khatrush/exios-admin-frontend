import { Action, Dispatch } from 'redux';
import { CHECK_AUTH, LOGIN, STATUS_ERROR, STATUS_START, STATUS_SUCCESS } from '../constants/actions';
import { addAuthInterceptor } from '../utils/AuthInterceptor';
import api from '../api';

export const login = function(username: string, password: string, loginType: 'admin' = 'admin') {
  
  return (dispatch: Dispatch<Action>): void => {
        
    dispatch({
      status: STATUS_START,
      type: LOGIN,
    });

    api.post('login', { username, password, loginType })
      .then(async ({ data }) => {
        addAuthInterceptor(data.token);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data));
        dispatch({
          payload: data,
          status: STATUS_SUCCESS,
          type: LOGIN,
        });
      })
      .catch(error => {
        dispatch({
          payload: { error },
          status: STATUS_ERROR,
          type: LOGIN,
        });
      })
    }
  }

export const checkAuth = (token: string) => {
  
  return (dispatch: Dispatch<Action>): void => {
    api.post('verifyToken', { token })
      .then(({ data }) => {
        // addAuthInterceptor(data.token);
        localStorage.setItem('authToken', data.token);
        dispatch({
          payload: data,
          status: STATUS_SUCCESS,
          type: CHECK_AUTH,
        });
      })
      .catch(error => {
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        dispatch({
          payload: { error },
          status: STATUS_ERROR,
          type: CHECK_AUTH,
        });
      })
    }
}

