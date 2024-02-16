import React, { Component } from 'react';
import { BiUser } from 'react-icons/bi';
import { MdPassword } from 'react-icons/md';
import Card from '../../components/Card/Card';
import CustomButton from '../../components/CustomButton/CustomButton';
import TextInput from '../../components/TextInput/TextInput';
import { connect } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { login } from '../../actions/session';
import { Alert, CircularProgress } from '@mui/material';
import { closeSidebar } from '../../actions/nav';
import withRouter from '../../utils/WithRouter/WithRouter';
import { getErrorMessage } from '../../utils/errorHandler';

import './Login.scss';

type Props = {
  router?: any
  session: any
  login: any
  closeSidebar: () => void
}

type State = {
  username: string;
  password: string;
}

class Login extends Component<Props, State> {

  public state = {
    username: '',
    password: ''
  }

  login = (e: any) => {
    e.preventDefault();
    const { username, password } = this.state;
    
    try {
      this.props.login(username.toLocaleLowerCase().trim(), password);
      this.props.router.navigate('/');
    } catch (error) {
      this.props.router.navigate('/login');
    }
    
  }
  
  render() {
    const { session } = this.props;
    // redirect user if authenticated
		if (localStorage.getItem("authToken")) {
			return (
				<Navigate to={'/'} />
			);
		}

    let errorMessage = '';
    if (session.isError && session?.error?.message) {
      errorMessage = getErrorMessage(session.error.message);
    }
    
    return (
      <div className='login-page'>
        <div className='login-card'>
          <Card>
            <div className='text-center mb-4'>
              <img src="https://storage.googleapis.com/exios-bucket/8424e4c2a34ab9e29b3b.png" style={{ minWidth: '180px' }} width={'50%'} height="50%" alt="Exios" />
            </div>
            {session.isError && 
              <Alert className='mb-3' severity="error">{errorMessage}</Alert>
            }
            <h2> Log in </h2>
            <p className='details'>Please enter the details</p>
            <form>
              <div className='mb-4'>
                <label htmlFor="username"> Username </label>
                <TextInput 
                  id="username" 
                  className="text-input" 
                  placeholder={'Enter your username'} 
                  icon={<BiUser />} 
                  onChange={(e: any) => this.setState({ username: e.target.value })} 
                />
              </div>

              <div className='mb-4'>
                <label htmlFor="password"> Password </label>
                <TextInput 
                  id='password' 
                  type='password' 
                  className="text-input" 
                  placeholder={'Enter your password'} 
                  icon={<MdPassword />} 
                  onChange={(e: any) => this.setState({ password: e.target.value })}
                />
              </div>

              <CustomButton 
                style={{ display: 'block', width: '100%'}} 
                href={''}
                background={'#039c1c'}
                onClick={(e: any) => this.login(e)}
              > 
              {this.props.session.isLoading ?
                <CircularProgress color="success" />
                :
                'Sign in'
              }
              </CustomButton>
            </form>
          </Card>
        </div>
      </div>
    )
  }
}

const mapStateToProps = (state: any) => {
	return {
		session: state.session,
	};
}

const mapDispatchToProps = {
    login,
    closeSidebar
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Login));