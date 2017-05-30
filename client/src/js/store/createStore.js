/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { createStore, combineReducers, applyMiddleware } from "redux";
import createSagaMiddleware from "redux-saga";

import { virusesReducer, createVirusReducer } from "../reducers/viruses";
import { accountReducer } from "../reducers/account";
import { rootSaga } from "../sagas/root";

const sagaMiddleware = createSagaMiddleware();

const reducer = combineReducers({
    viruses: virusesReducer,
    createVirus: createVirusReducer,
    account: accountReducer
});

export const store = createStore(
    reducer,
    applyMiddleware(sagaMiddleware)
);

sagaMiddleware.run(rootSaga);
