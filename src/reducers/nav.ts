import { CLOSE_SIDEBAR, OPEN_SIDEBAR, TOGGLE_SIDEBAR } from "../constants/actions";
import { isMobile } from "react-device-detect";

type INavbar = {
  isSidebarOpen: boolean
}

export const initialState: INavbar = {
  isSidebarOpen: isMobile ? false : true
};

export const nav = (state: INavbar = initialState, action: any) => {
  switch(action.type) {
    case TOGGLE_SIDEBAR: {
      return {
        ...state,
        isSidebarOpen: !state.isSidebarOpen
      }
    }

    case OPEN_SIDEBAR: {
      return {
        ...state,
        isSidebarOpen: true
      }
    }

    case CLOSE_SIDEBAR: {
      return {
        ...state,
        isSidebarOpen: false
      }
    }

    default:
      return state;
  }
}