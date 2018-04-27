import React from "react";
import ReactDOM from "react-dom";
import Raven from "raven-js";

import App from "./App";
import WSConnection from "./websocket";
import createHistory from "history/createBrowserHistory";
import { getAccount } from "./account/actions";
import { getSettings } from "./settings/actions";
import { createStore, combineReducers, applyMiddleware } from "redux";
import createSagaMiddleware from "redux-saga";
import { routerReducer, routerMiddleware } from "react-router-redux";

import { SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";
import jobsReducer from "./jobs/reducer";
import samplesReducer from "./samples/reducer";
import indexesReducer from "./indexes/reducer";
import virusesReducer from "./viruses/reducer";
import subtractionReducer from "./subtraction/reducer";
import filesReducer from "./files/reducer";
import accountReducer from "./account/reducer";
import settingsReducer from "./settings/reducer";
import usersReducer from "./users/reducer";
import groupsReducer from "./groups/reducer";
import updatesReducer from "./updates/reducer";
import hmmsReducer from "./hmm/reducer";
import errorsReducer from "./errors/reducer";
import rootSaga from "./sagas";

export * from "../style/style.less";

Raven.config("https://d9ea493cb0f34ad4a141da5506e6b03b@sentry.io/220541").install();

window.Raven = Raven;

const sagaMiddleware = createSagaMiddleware();

const appInitialState = {
    pending: false
};

const appReducer = (state = appInitialState, action) => {

    switch (action.type) {

        case SET_APP_PENDING:
            return {...state, pending: true};

        case UNSET_APP_PENDING:
            return {...state, pending: false};
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
        hmms: hmmsReducer,
        errors: errorsReducer,
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
