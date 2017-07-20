/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeEvery, takeLatest } from "redux-saga/effects";

import filesAPI from "./api";
import { setPending } from "../wrappers";
import { WS_UPDATE_FILE, WS_REMOVE_FILE, FIND_FILES, REMOVE_FILE, UPLOAD_READS }  from "../actionTypes";

export function* watchFiles () {
    yield takeLatest(WS_REMOVE_FILE, wsUpdateFile);
    yield takeLatest(WS_UPDATE_FILE, wsUpdateFile);
    yield takeLatest(FIND_FILES.REQUESTED, findFiles);
    yield takeEvery(REMOVE_FILE.REQUESTED, removeFile);
    yield takeEvery(UPLOAD_READS.REQUESTED, uploadReads);
}

export function* wsUpdateFile () {
    try {
        const response = yield call(filesAPI.find);
        yield put({type: FIND_FILES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_FILES.FAILED}, error);
    }
}

export function* findFiles (action) {
    yield setPending(function* () {
        try {
            const response = yield call(filesAPI.find);
            yield put({type: FIND_FILES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_FILES.FAILED}, error);
        }
    }, action);
}

export function* removeFile (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(filesAPI.remove, action.fileId);
            yield put({type: REMOVE_FILE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: REMOVE_FILE.FAILED}, error);
        }
    }, action)
}

export function * uploadReads (action) {
    try {
        const response = yield call(filesAPI.uploadReads, action.file, action.onProgress);
        yield put({type: UPLOAD_READS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: UPLOAD_READS.FAILED}, error);
    }
}

