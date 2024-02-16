import { Action, Dispatch } from "redux"
import api from "../api";
import { GET_ACTIVITIES, STATUS_ERROR, STATUS_LOADING, STATUS_SUCCESS } from "../constants/actions";

export const getActivities = (query?: { limit?: number, skip?: number }) => {
  return (dispatch: Dispatch<Action>): void => {
    dispatch({
      status: STATUS_LOADING,
      type: GET_ACTIVITIES,
    });
    
    api.get('activities', query)
      .then(({ data }) => {
        dispatch({
          payload: { data },
          status: STATUS_SUCCESS,
          type: GET_ACTIVITIES,
        });
      })
      .catch(error => {
        dispatch({
          payload: { error },
          status: STATUS_ERROR,
          type: GET_ACTIVITIES,
        });
      })
  }
}