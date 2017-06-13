/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { createStore, combineReducers, applyMiddleware } from "redux";
import createSagaMiddleware from "redux-saga";

import { SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";
import jobsReducer from "./jobs/reducers";
import samplesReducer from "./samples/reducers";
import { virusesReducer } from "./viruses/reducers";
import { accountReducer } from "./nav/reducers";
import settingsReducer from "./settings/reducers";
import usersReducer from "./settings/users/reducers";
import groupsReducer from "./settings/groups/reducers";
import { rootSaga } from "./sagas";

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

const reducer = combineReducers({
    app: appReducer,
    jobs: jobsReducer,
    samples: samplesReducer,
    viruses: virusesReducer,
    settings: settingsReducer,
    users: usersReducer,
    groups: groupsReducer,
    account: accountReducer
});

export const store = createStore(
    reducer,
    applyMiddleware(sagaMiddleware)
);

sagaMiddleware.run(rootSaga);
