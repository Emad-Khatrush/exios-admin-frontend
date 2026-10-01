import React from "react";

import { NavLink } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import { connect } from "react-redux";
import { closeSidebar } from "../../actions/nav";
import { Account } from "../../models";
import getRoutes from "./routes";
import AccountingGate from "../../containers/Accounting/AccountingGate";
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
        // On desktop the top bar scrolls away with the page, so the sidebar sticks to the very top
        // and uses the full height (no empty band above it)
        const sidebarStyle = { left: this.props.isSidebarOpen ? '0' : '-240px', ...(isMobile ? {} : { top: 0, height: '100vh' }) };
        const routes = getRoutes(this.props.account?.roles);

        return(
            <div style={{...sidebarStyle, position: isMobile ? 'fixed' : 'sticky'}} className="sidebar">
              <div className="sidebar-wrapper">
                <div className="sidebar-menu">
                  <ul className="sidebar-list">
                    {routes && routes.map((route: any) => {
                        let item;
                        if (route?.mainTitle) {
                            item = <h3 className="sidebar-title" key={`title-${route.mainTitle}`}> {route.mainTitle} </h3>
                        } else item = (
                        <NavLink  
                            className="sidebar-list-item" 
                            key={route.title} 
                            to={route.path}
                            onClick={() => isMobile && this.props.closeSidebar()} 
                        >
                            {route.icon}
                            {route.title}
                        </NavLink>
                      )
                        // Accounting shows only for whoever the owner gave access to
                        return route?.accountingGate ? <AccountingGate key={`gate-${route.title || route.mainTitle}`}>{item}</AccountingGate> : item;
                    })}
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
