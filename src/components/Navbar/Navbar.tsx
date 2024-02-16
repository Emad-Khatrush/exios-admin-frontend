import { Component } from 'react';
import { Badge, IconButton } from '@mui/material';

import { IoMdNotificationsOutline } from 'react-icons/io';
import { GiHamburgerMenu } from 'react-icons/gi';
import { isMobile } from 'react-device-detect';
import Logo from '../Logo/Logo';

import './Navbar.scss'
import { toggleSidebar } from '../../actions/nav';
import { connect } from 'react-redux';
import { Session } from '../../models';

type MyProps = {
    isSidebarOpen: boolean
    toggleSidebar: () => void
    session: Session
};

type MyState = {
  openLogoMenu: boolean
};

class Navbar extends Component<MyProps, MyState> {

    state = {
      openLogoMenu: false
    }

    render() {
        const { openLogoMenu } = this.state;
        
        return (
            <div className='navbar'>
                <div className="navbar-wrapper">
                    <div className="nav-left">
                        {isMobile ? 
                          <GiHamburgerMenu 
                            className='hamburger-icon' 
                            size={30}
                            onClick={() => this.props.toggleSidebar()}
                          />
                          :
                          <img src="https://storage.googleapis.com/exios-bucket/8424e4c2a34ab9e29b3b.png" alt="Exios" width={'150px'} height={'80px'} />
                        }
                    </div>
                    <div className="nav-right">
                        <div className="icon-countainer">
                            <IconButton aria-label={'cart'}>
                                <Badge badgeContent={100} color="success">
                                    <IoMdNotificationsOutline />
                                </Badge>
                            </IconButton>
                        </div>
                        {/* <div className="icon-countainer">
                            <MdLanguage />
                        </div>
                        <div className="icon-countainer">
                            <IoMdSettings />
                        </div> */}
                        <Logo
                          src={this.props.session?.account?.imgUrl}
                          alt={this.props.session?.account?.firstName}
                          open={openLogoMenu} 
                          onOpen={() => this.setState({ openLogoMenu: true })}
                          onClose={() => this.setState({ openLogoMenu: false })}
                        />
                    </div>
                </div>
            </div>
        )
    }
}

const mapStateToProps = (state: any) => {
	return {
		isSidebarOpen: state.nav.isSidebarOpen,
	};
}

const mapDispatchToProps = {
    toggleSidebar,
};

export default connect(mapStateToProps, mapDispatchToProps)(Navbar);