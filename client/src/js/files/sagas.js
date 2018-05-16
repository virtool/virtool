import { noop } from "lodash-es";
import { buffers, END, eventChannel } from "redux-saga";
import { call, put, select, take, takeEvery, takeLatest } from "redux-saga/effects";

import * as filesAPI from "./api";
import { putGenericError, setPending, apiCall } from "../sagaUtils";
import { WS_UPDATE_FILE, WS_REMOVE_FILE, FIND_FILES, REMOVE_FILE, UPLOAD } from "../actionTypes";
import { uploadProgress } from "./actions";

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

    const { file, fileType, localId } = action;

    const channel = yield call(createUploadChannel, file, fileType);

    while (true) {
        const { progress = 0, response, err } = yield take(channel);

        if (err) {
            return yield putGenericError(UPLOAD, err);
        }

        if (response) {
            yield put({type: UPLOAD.SUCCEEDED, data: response.body});
            return yield findFiles(action.fileType);
        }

        yield put(uploadProgress(localId, progress));
    }
}

const createUploadChannel = (file, fileType) => (
    eventChannel(emitter => {
        const onProgress = (e) => {
            if (e.lengthComputable) {
                emitter({progress: e.percent});
            }
        };

        const onSuccess = (response) => {
            emitter({response});
            emitter(END);
        };

        const onFailure = (err) => {
            emitter({err});
            emitter(END);
        };

        filesAPI.upload(
            file,
            fileType,
            onProgress,
            onSuccess,
            onFailure
        );

        return noop;
    }, buffers.sliding(2))
);
