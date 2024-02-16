import { createStore, combineReducers, applyMiddleware  } from 'redux';
import thunk from 'redux-thunk';
import logger from 'redux-logger';

import { session } from '../reducers/session';
import { invoice } from '../reducers/invoices';
import { expense } from '../reducers/expenses';
import { activity } from '../reducers/activities';
import { nav } from '../reducers/nav';

const reducers = combineReducers<any>({
  session,
  invoice,
  expense,
  activity,
  nav
});

export default function configureStore() {
  return createStore(reducers, applyMiddleware(
    thunk,
    logger
  ),);
}
