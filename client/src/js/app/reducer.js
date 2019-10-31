import { connectRouter, routerMiddleware } from "connected-react-router";
import { applyMiddleware, combineReducers, createStore } from "redux";
import createSagaMiddleware from "redux-saga";
import accountReducer from "../account/reducer";
import cachesReducer from "../caches/reducer";
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
import { CREATE_FIRST_USER, LOGIN, LOGOUT, RESET_PASSWORD, SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";
import rootSaga from "./sagas";

export const getInitialState = () => {
    const { dev, first, login } = window.virtool;

    return {
        dev,
        first,
        login,
        reset: false,
        pending: false
    };
};

export const appReducer = (state = getInitialState(), action) => {
    switch (action.type) {
        case SET_APP_PENDING:
            return { ...state, pending: true };

        case UNSET_APP_PENDING:
            return { ...state, pending: false };

        case LOGIN.SUCCEEDED:
            if (action.data.reset) {
                return {
                    ...state,
                    login: false,
                    reset: true,
                    resetCode: action.data.reset_code
                };
            }

            return {
                ...state,
                login: false,
                reset: false
            };

        case LOGIN.FAILED:
            return {
                ...state,
                login: true
            };

        case LOGOUT.SUCCEEDED:
            return {
                ...state,
                login: true
            };

        case RESET_PASSWORD.SUCCEEDED:
            return {
                ...state,
                login: false,
                reset: false,
                resetCode: null,
                resetError: null
            };

        case RESET_PASSWORD.FAILED:
            return {
                ...state,
                login: false,
                reset: true,
                resetCode: action.data.reset_code,
                resetError: action.data.error
            };

        case CREATE_FIRST_USER.SUCCEEDED:
            return {
                ...state,
                login: false,
                first: false
            };
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
            caches: cachesReducer,
            errors: errorsReducer,
            files: filesReducer,
            groups: groupsReducer,
            hmms: hmmsReducer,
            indexes: indexesReducer,
            jobs: jobsReducer,
            otus: otusReducer,
            processes: processesReducer,
            references: referencesReducer,
            router: connectRouter(history),
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
