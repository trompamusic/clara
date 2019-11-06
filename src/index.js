import React, { Component }  from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import ReduxPromise from 'redux-promise';
import { Router, Route, browserHistory } from 'react-router'

import { reducers } from 'meld-clients-core/src/reducers';
import FeatureVisCompanion from './containers/companion';
import RealtimeCompanion from './containers/realtimeCompanion';

const createStoreWithMiddleware = applyMiddleware(thunk, ReduxPromise)(createStore);

ReactDOM.render(
	<Provider store={createStoreWithMiddleware(reducers)}>
		<Router history={browserHistory}> 
			<Route path="/" component={RealtimeCompanion} />
			<Route path="/vis" component={FeatureVisCompanion} />
		</Router>
	</Provider>
		, document.querySelector('.container')
);
