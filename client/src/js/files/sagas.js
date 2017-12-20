import { put, select, takeEvery, takeLatest } from "redux-saga/effects";

import filesAPI from "./api";
import { putGenericError, setPending, apiCall } from "../sagaUtils";
import { WS_UPDATE_FILE, WS_REMOVE_FILE, FIND_FILES, REMOVE_FILE, UPLOAD } from "../actionTypes";

export function* watchFiles () {
    yield takeLatest(WS_REMOVE_FILE, wsUpdateFile);
    yield takeLatest(WS_UPDATE_FILE, wsUpdateFile);
    yield takeLatest(FIND_FILES.REQUESTED, findFilesWithPending);
    yield takeEvery(REMOVE_FILE.REQUESTED, removeFile);
    yield takeEvery(UPLOAD.REQUESTED, upload);
}

export function* wsUpdateFile () {
    const fileType = yield select(state => state.files.fileType);
    yield findFiles(fileType);
}

export function* findFiles (fileType, page) {
    try {
        const response = yield filesAPI.find(fileType, page);
        yield put({type: FIND_FILES.SUCCEEDED, data: response.body, fileType});
    } catch (error) {
        yield putGenericError(FIND_FILES, error);
    }
}

export function* findFilesWithPending (action) {
    yield setPending(findFiles(action.fileType, action.page));
}

export function* removeFile (action) {
    yield setPending(apiCall(filesAPI.remove, action, REMOVE_FILE));
}

export function* upload (action) {
    try {
        yield filesAPI.upload(action.file, action.fileType, action.onProgress);
        yield findFiles(action.fileType);
    } catch (error) {
        yield putGenericError(UPLOAD, error);
    }
}

