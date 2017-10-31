import React from "react";
import ReactDOM from "react-dom";
import Raven from "raven-js";

import App from "./App";
import WSConnection from "./websocket";
import createHistory from "history/createBrowserHistory";
import { getAccount } from "./account/actions";
import { getSettings } from "./settings/actions";
import { assign } from "lodash";
import { createStore, combineReducers, applyMiddleware } from "redux";
import createSagaMiddleware from "redux-saga";
import { routerReducer, routerMiddleware } from "react-router-redux";

import { SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";
import jobsReducer from "./jobs/reducers";
import samplesReducer from "./samples/reducers";
import indexesReducer from "./indexes/reducers";
import virusesReducer from "./viruses/reducers";
import subtractionReducer from "./subtraction/reducers";
import filesReducer from "./files/reducer";
import accountReducer from "./account/reducers";
import settingsReducer from "./settings/reducers";
import usersReducer from "./users/reducers";
import groupsReducer from "./groups/reducers";
import updatesReducer from "./updates/reducers";
import rootSaga from "./sagas";

export * from "../style/style.less";

Raven.config("https://9a2f8d1a3f7a431e873207a70ef3d44d@sentry.io/220532").install();

window.Raven = Raven;

const sagaMiddleware = createSagaMiddleware();

const appInitialState = {
    pending: false
};

const appReducer = (state = appInitialState, action) => {

    switch (action.type) {

        case SET_APP_PENDING:
            return assign({}, state, {pending: true});

        case UNSET_APP_PENDING:
            return assign({}, state, {pending: false});
    }

    return state;
};

const history = createHistory();

const store = createStore(
    combineReducers({
        app: appReducer,
        jobs: jobsReducer,
        samples: samplesReducer,
        viruses: virusesReducer,
        indexes: indexesReducer,
        subtraction: subtractionReducer,
        files: filesReducer,
        settings: settingsReducer,
        users: usersReducer,
        groups: groupsReducer,
        account: accountReducer,
        updates: updatesReducer,
        router: routerReducer
    }),
    applyMiddleware(sagaMiddleware, routerMiddleware(history)),
);

sagaMiddleware.run(rootSaga);

window.store = store;

window.ws = new WSConnection(store.dispatch);
window.ws.establishConnection();

window.store.dispatch(getAccount());
window.store.dispatch(getSettings());

window.addEventListener("beforeunload", () => {
    if (!window.store.getState().files.uploadsComplete) {
        return "hello world";
    }
});

ReactDOM.render(
    <App store={store} history={history} />,
    document.getElementById("app-container")
);
