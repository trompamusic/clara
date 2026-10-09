import "./runawayEffects";
import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { createStore, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import ReduxPromise from "redux-promise";

import { createReducers } from "meld-clients-core/lib/reducers";
import App from "./containers/App";

const createStoreWithMiddleware = applyMiddleware(
  thunk,
  ReduxPromise,
)(createStore);
const reducers = createReducers({ computeOutcomesHash: false });

ReactDOM.render(
  <Provider store={createStoreWithMiddleware(reducers)}>
    <App />
  </Provider>,
  document.querySelector(".container"),
);
