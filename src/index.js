import React, { Component }  from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import ReduxPromise from 'redux-promise';
import { BrowserRouter, Route } from 'react-router-dom'

import { reducers } from 'meld-clients-core/lib/reducers';
import PieceSelection from './containers/pieceSelection';

const createStoreWithMiddleware = applyMiddleware(thunk, ReduxPromise)(createStore);

ReactDOM.render(
	<Provider store={createStoreWithMiddleware(reducers)}>
		<BrowserRouter>
      <div>
        <Route path="/" component={PieceSelection} />
      </div>
		</BrowserRouter>
	</Provider>
		, document.querySelector('.container')
);
