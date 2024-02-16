import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import Sidebar from '../components/Sidebar/Sidebar';
import { Backdrop, CircularProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux'
import { isMobile } from 'react-device-detect';
import { Session } from '../models';
import { Suspense, useEffect } from 'react';
import { CLOSE_SIDEBAR } from '../constants/actions';

import '../App.scss';

type Props = {
  session: Session
}

const PrivateRoute = (props: Props) => {
  const isSidebarOpen = useSelector((state: any) => state.nav.isSidebarOpen);
  const dispatch = useDispatch();
  const history = useNavigate();
  const location = useLocation();

  const redirectPathFound = localStorage.getItem('rd_path');
  
  if (!props.session.isLoggedIn && !redirectPathFound) {
    const redirectPath = `${location.pathname}${location.search}`;
    // Redirect path after login
    localStorage.setItem('rd_path', redirectPath)
  }

  useEffect(() => {
    if (props.session.isLoggedIn && redirectPathFound) {
      history(redirectPathFound)
      localStorage.removeItem('rd_path');
    }
  }, [])
  
  return props.session.isLoggedIn ?
  (
    <>
      <Navbar session={props.session} />
      <div className='d-flex'>
        {isMobile ?
          <Backdrop
            sx={{ zIndex: 400 }}
            open={isSidebarOpen}
            onClick={() => dispatch({ type: CLOSE_SIDEBAR })}
          >
            <Sidebar />
          </Backdrop>
        :
        <Sidebar />
        }
        <Suspense fallback={<CircularProgress />}>
          <div className="otherpages">
            <Outlet />
          </div>
        </Suspense>
      </div>
    </>
  ) 
  : 
  (<Navigate to="/login" />);
}

export default PrivateRoute;