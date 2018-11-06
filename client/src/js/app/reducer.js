import { routerMiddleware, routerReducer } from "react-router-redux";
import { applyMiddleware, combineReducers, createStore } from "redux";
import createSagaMiddleware from "redux-saga";
import accountReducer from "../account/reducer";
import settingsReducer from "../administration/reducer";
import analysesReducer from "../analyses/reducer";
import errorsReducer from "../errors/reducer";
import filesReducer from "../files/reducer";
import groupsReducer from "../groups/reducer";
import hmmsReducer from "../hmm/reducer";
import indexesReducer from "../indexes/reducer";
import jobsReducer from "../jobs/reducer";
import otusReducer from "../otus/reducer";
import processesReducer from "../processes/reducer";
import referencesReducer from "../references/reducer";
import samplesReducer from "../samples/reducer";
import subtractionReducer from "../subtraction/reducer";
import updatesReducer from "../updates/reducer";
import usersReducer from "../users/reducer";
import { SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";
import rootSaga from "./sagas";

const appInitialState = {
    pending: false
};

const appReducer = (state = appInitialState, action) => {
    switch (action.type) {
        case SET_APP_PENDING:
            return { ...state, pending: true };

        case UNSET_APP_PENDING:
            return { ...state, pending: false };
    }

    return state;
};

export const createAppStore = history => {
    const sagaMiddleware = createSagaMiddleware();

    const store = createStore(
        combineReducers({
            account: accountReducer,
            analyses: analysesReducer,
            app: appReducer,
            errors: errorsReducer,
            files: filesReducer,
            groups: groupsReducer,
            hmms: hmmsReducer,
            indexes: indexesReducer,
            jobs: jobsReducer,
            otus: otusReducer,
            processes: processesReducer,
            references: referencesReducer,
            router: routerReducer,
            samples: samplesReducer,
            settings: settingsReducer,
            subtraction: subtractionReducer,
            updates: updatesReducer,
            users: usersReducer
        }),
        applyMiddleware(sagaMiddleware, routerMiddleware(history))
    );

    sagaMiddleware.run(rootSaga);

    return store;
};
