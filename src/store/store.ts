import { createStore, combineReducers, applyMiddleware  } from 'redux';
import thunk from 'redux-thunk';
import logger from 'redux-logger';

import { session } from '../reducers/session';
import { invoice } from '../reducers/invoices';
import { activity } from '../reducers/activities';
import { nav } from '../reducers/nav';

const reducers = combineReducers<any>({
  session,
  invoice,
  activity,
  nav
});

export default function configureStore() {
  return createStore(reducers, applyMiddleware(
    thunk,
    logger
  ),);
}
