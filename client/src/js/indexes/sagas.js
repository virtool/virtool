import { put, takeEvery, takeLatest } from "redux-saga/effects";

import * as indexesAPI from "./api";
import { apiCall, setPending } from "../sagaUtils";
import { FIND_INDEXES, GET_INDEX, GET_UNBUILT, CREATE_INDEX, GET_INDEX_HISTORY } from "../actionTypes";

export function* watchIndexes () {
    yield takeLatest(FIND_INDEXES.REQUESTED, findIndexes);
    yield takeLatest(GET_INDEX.REQUESTED, getIndex);
    yield takeLatest(GET_UNBUILT.REQUESTED, getUnbuilt);
    yield takeEvery(CREATE_INDEX.REQUESTED, createIndex);
    yield takeLatest(GET_INDEX_HISTORY.REQUESTED, getIndexHistory);
}

export function* findIndexes () {
    yield apiCall(indexesAPI.find, {}, FIND_INDEXES);
}

export function* getIndex (action) {
    yield apiCall(indexesAPI.get, action, GET_INDEX);
}

export function* getUnbuilt () {
    yield apiCall(indexesAPI.getUnbuilt, {}, GET_UNBUILT);
}

export function* createIndex () {
    yield setPending(apiCall(indexesAPI.create, {}, CREATE_INDEX));
    yield put({type: FIND_INDEXES.REQUESTED});
}

export function* getIndexHistory (action) {
    yield setPending(apiCall(indexesAPI.getHistory, action, GET_INDEX_HISTORY));
}
