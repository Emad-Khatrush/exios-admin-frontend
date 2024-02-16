import React from "react";

import { NavLink } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import { connect } from "react-redux";
import { closeSidebar } from "../../actions/nav";
import { Account } from "../../models";
import getRoutes from "./routes";
import './Sidebar.scss';

type MyProps = {
    isSidebarOpen: boolean
    account: Account
    closeSidebar: () => void
};
type MyState = {
    sidebar: boolean;
};

class Sidebar extends React.Component<MyProps, MyState> {

    
    render() {
        const sidebarStyle = { left: this.props.isSidebarOpen ? '0' : '-240px' };
        const routes = getRoutes(this.props.account?.roles);

        return(
            <div style={{...sidebarStyle, position: isMobile ? 'fixed' : 'sticky'}} className="sidebar">
                <div className="sidebar-wrapper">
                <div className="sidebar-menu">
                    <h3 className="sidebar-title"> Dashboard </h3>
                    <ul className="sidebar-list">
                        {routes && routes.map( route => 
                            <NavLink 
                              className="sidebar-list-item" 
                              key={route.title} 
                              to={route.path}
                              onClick={() => isMobile && this.props.closeSidebar()} 
                            >
                              {route.icon}
                              {route.title}
                            </NavLink>
                        )}
                    </ul>
                </div>
                </div>
            </div>
        )
    }
}

const mapStateToProps = (state: any) => {
	return {
		isSidebarOpen: state.nav.isSidebarOpen,
        account: state.session.account
	};
}

const mapDispatchToProps = {
    closeSidebar,
};

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
