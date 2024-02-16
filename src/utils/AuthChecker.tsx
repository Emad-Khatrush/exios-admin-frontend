import React, { Component } from 'react'
import { connect } from 'react-redux'
import { checkAuth } from '../actions/session'
import { addAuthInterceptor } from './AuthInterceptor';
import withRouter from './WithRouter/WithRouter';

type Props = {
  session?: any
  checkAuth: any
}

type State = {
}

export class AuthChecker extends Component<Props, State> {

  public componentDidMount() {
    const { token, isLoggedIn } = this.props.session;
    if (isLoggedIn) {
      addAuthInterceptor(token);
      this.props.checkAuth(token);
    }
  }
  
  render() {
    return <div />;
  }
}

const mapStateToProps = (state: any) => ({
  session: state.session
})

const mapDispatchToProps = {
  checkAuth,
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AuthChecker));