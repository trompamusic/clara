import "stop-runaway-react-effects/hijack";
import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { createStore, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import ReduxPromise from "redux-promise";

import { reducers } from "meld-clients-core/lib/reducers";
import App from "./containers/App";

const createStoreWithMiddleware = applyMiddleware(
  thunk,
  ReduxPromise,
)(createStore);

ReactDOM.render(
  <Provider store={createStoreWithMiddleware(reducers)}>
    <App />
  </Provider>,
  document.querySelector(".container"),
);
