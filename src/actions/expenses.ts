import { Action, Dispatch } from "redux"
import api from "../api";
import { CREATE_EXPENSE, GET_EXPENSES, RESET_EXPENSE, STATUS_ERROR, STATUS_START, STATUS_SUCCESS } from "../constants/actions";

export const resetExpense = () => {
  return (dispatch: Dispatch<Action>): void => {
    dispatch({
      type: RESET_EXPENSE
    });
  }
}

export const createExpense = (data: any) => {
  return (dispatch: Dispatch<Action>): void => {
    dispatch({
      status: STATUS_START,
      type: CREATE_EXPENSE,
    });

    api.fetchFormData('expenses', 'POST', data)
      .then((res: any) => {
        if (!(res?.success !== undefined && !res?.success)) {
          dispatch({
            status: STATUS_SUCCESS,
            type: CREATE_EXPENSE,
          });
        } else {
          dispatch({
            payload: { error: res.statusText },
            status: STATUS_ERROR,
            type: CREATE_EXPENSE,
          });
        }
        // window.setTimeout(function(){
        //   window.location.replace('/expenses');
        // }, 2500);
      })
      .catch(error => {
        dispatch({
          payload: { error },
          status: STATUS_ERROR,
          type: CREATE_EXPENSE,
        });
      })
  }
}

export const getExpenses = () => {
  return (dispatch: Dispatch<Action>): void => {
    dispatch({
      status: STATUS_START,
      type: GET_EXPENSES,
    });

    api.get('expenses')
      .then(({ data }) => {
        dispatch({
          payload: { data },
          status: STATUS_SUCCESS,
          type: GET_EXPENSES,
        });
      })
      .catch(error => {
        dispatch({
          payload: { error },
          status: STATUS_ERROR,
          type: GET_EXPENSES,
        });
      })
  }
}
