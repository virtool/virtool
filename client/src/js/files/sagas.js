import { put, select, takeEvery, takeLatest } from "redux-saga/effects";

import * as filesAPI from "./api";
import { putGenericError, setPending, apiCall } from "../sagaUtils";
import { WS_UPDATE_FILE, WS_REMOVE_FILE, FIND_FILES, REMOVE_FILE, UPLOAD } from "../actionTypes";

export function* watchFiles () {
    yield takeLatest(WS_REMOVE_FILE, wsUpdateFile);
    yield takeLatest(WS_UPDATE_FILE, wsUpdateFile);
    yield takeLatest(FIND_FILES.REQUESTED, findFiles);
    yield takeEvery(REMOVE_FILE.REQUESTED, removeFile);
    yield takeEvery(UPLOAD.REQUESTED, upload);
}

export function* wsUpdateFile () {
    const fileType = yield select(state => state.files.fileType);
    yield findFiles({fileType});
}

export function* findFiles (action) {
    try {
        const response = yield filesAPI.find(action);
        yield put({type: FIND_FILES.SUCCEEDED, data: response.body, fileType: action.fileType});
    } catch (error) {
        yield putGenericError(FIND_FILES, error);
    }
}

export function* removeFile (action) {
    yield setPending(apiCall(filesAPI.remove, action, REMOVE_FILE));
}

export function* upload (action) {
    try {
        yield filesAPI.upload(action);
        yield findFiles(action.fileType);
    } catch (error) {
        yield putGenericError(UPLOAD, error);
    }
}

