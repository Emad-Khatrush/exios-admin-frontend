import { Action, Dispatch } from "redux";
import { CLOSE_SIDEBAR, OPEN_SIDEBAR, TOGGLE_SIDEBAR } from "../constants/actions";


export const toggleSidebar = () => {
  return (dispatch: Dispatch<Action>): void => {    
    dispatch({
      type: TOGGLE_SIDEBAR
    });
  }
}

export const openSidebar = () => {
  return (dispatch: Dispatch<Action>): void => {    
    dispatch({
      type: OPEN_SIDEBAR
    });
  }
}

export const closeSidebar = () => {
  return (dispatch: Dispatch<Action>): void => {    
    dispatch({
      type: CLOSE_SIDEBAR
    });
  }
}
