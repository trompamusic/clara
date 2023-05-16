import 'stop-runaway-react-effects/hijack'
import React  from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import ReduxPromise from 'redux-promise';

import { reducers } from 'meld-clients-core/lib/reducers';
import App from "./containers/App";

const createStoreWithMiddleware = applyMiddleware(thunk, ReduxPromise)(createStore);
const container = document.querySelector('.container');
const root = createRoot(container!);

root.render(
	<Provider store={createStoreWithMiddleware(reducers)}>
          <App />
	</Provider>
);
