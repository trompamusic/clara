import "./runawayEffects";
import { installRateLimiter } from "./util/installRateLimiter";

// Must run before anything makes a request: the Solid auth library, LDO and
// meld all call the global fetch by name.
installRateLimiter();

import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { createStore, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import ReduxPromise from "redux-promise";

import { addReducerSet } from "meld-clients-core/lib/reducers";
import TimeSyncReducer from "meld-clients-core/lib/reducers/reducer_timesync";
import { withClockRegistration } from "./clockRegistration";
import App from "./containers/App";

const reducers = addReducerSet("timesync", withClockRegistration(TimeSyncReducer));

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
