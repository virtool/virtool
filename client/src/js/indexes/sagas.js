import { put, takeEvery, takeLatest, select } from "redux-saga/effects";
import * as indexesAPI from "./api";
import { apiCall, setPending } from "../sagaUtils";
import {
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    LIST_READY_INDEXES
} from "../actionTypes";

export function* watchIndexes () {
    yield takeLatest(WS_UPDATE_INDEX, wsUpdateIndex);
    yield takeLatest(FIND_INDEXES.REQUESTED, findIndexes);
    yield takeLatest(GET_INDEX.REQUESTED, getIndex);
    yield takeLatest(GET_UNBUILT.REQUESTED, getUnbuilt);
    yield takeEvery(CREATE_INDEX.REQUESTED, createIndex);
    yield takeLatest(GET_INDEX_HISTORY.REQUESTED, getIndexHistory);
    yield takeLatest(LIST_READY_INDEXES.REQUESTED, listReadyIndexes);
}

export function* wsUpdateIndex (action) {
    const refId = yield select(state => state.references.detail.id);

    if (refId === action.data.reference.id && action.data.has_files) {
        yield put({
            type: FIND_INDEXES.REQUESTED,
            refId: action.data.reference.id,
            page: 1
        });
    }
}

export function* findIndexes (action) {
    yield apiCall(indexesAPI.find, action, FIND_INDEXES);
}

export function* getIndex (action) {
    yield apiCall(indexesAPI.get, action, GET_INDEX);
}

export function* getUnbuilt (action) {
    yield apiCall(indexesAPI.getUnbuilt, action, GET_UNBUILT);
}

export function* listReadyIndexes (action) {
    yield apiCall(indexesAPI.listReady, action, LIST_READY_INDEXES);
}

export function* createIndex (action) {
    yield setPending(apiCall(indexesAPI.create, action, CREATE_INDEX));
    yield put({
        type: FIND_INDEXES.REQUESTED,
        refId: action.refId,
        page: 1
    });
}

export function* getIndexHistory (action) {
    yield setPending(apiCall(indexesAPI.getHistory, action, GET_INDEX_HISTORY));
}
