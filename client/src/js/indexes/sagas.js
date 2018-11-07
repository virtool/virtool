import { push } from "connected-react-router";
import { apiCall, setPending } from "../utils/sagas";
import {
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    LIST_READY_INDEXES
} from "../app/actionTypes";
import * as indexesAPI from "./api";
import { put, takeEvery, takeLatest } from "redux-saga/effects";

export function* watchIndexes() {
    yield takeLatest(FIND_INDEXES.REQUESTED, findIndexes);
    yield takeLatest(GET_INDEX.REQUESTED, getIndex);
    yield takeLatest(GET_UNBUILT.REQUESTED, getUnbuilt);
    yield takeEvery(CREATE_INDEX.REQUESTED, createIndex);
    yield takeLatest(GET_INDEX_HISTORY.REQUESTED, getIndexHistory);
    yield takeLatest(LIST_READY_INDEXES.REQUESTED, listReadyIndexes);
}

export function* findIndexes(action) {
    yield apiCall(indexesAPI.find, action, FIND_INDEXES);
}

export function* getIndex(action) {
    yield apiCall(indexesAPI.get, action, GET_INDEX);
}

export function* getUnbuilt(action) {
    yield apiCall(indexesAPI.getUnbuilt, action, GET_UNBUILT);
}

export function* listReadyIndexes(action) {
    yield apiCall(indexesAPI.listReady, action, LIST_READY_INDEXES);
}

export function* createIndex(action) {
    const extraFunc = {
        closeModal: put(push({ state: { rebuild: false } }))
    };
    yield setPending(apiCall(indexesAPI.create, action, CREATE_INDEX, {}, extraFunc));
}

export function* getIndexHistory(action) {
    yield setPending(apiCall(indexesAPI.getHistory, action, GET_INDEX_HISTORY));
}
