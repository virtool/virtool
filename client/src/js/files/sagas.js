import { noop } from "lodash-es";
import { buffers, END, eventChannel } from "redux-saga";
import { putGenericError, setPending, apiCall } from "../utils/sagas";
import { FIND_FILES, REMOVE_FILE, UPLOAD, UPLOAD_SAMPLE_FILE } from "../app/actionTypes";
import * as filesAPI from "./api";
import { uploadProgress } from "./actions";
import { call, put, take, takeEvery, takeLatest } from "redux-saga/effects";

export function* watchFiles() {
    yield takeLatest(FIND_FILES.REQUESTED, findFiles);
    yield takeEvery(REMOVE_FILE.REQUESTED, removeFile);
    yield takeEvery(UPLOAD.REQUESTED, upload);
}

export function* findFiles(action) {
    yield apiCall(filesAPI.list, action, FIND_FILES, {
        fileType: action.fileType
    });
}

export function* removeFile(action) {
    yield setPending(apiCall(filesAPI.remove, action, REMOVE_FILE));
}

export function* upload(action) {
    const { localId } = action;
    const channel = yield call(createUploadChannel, action, filesAPI.upload);
    yield watchUploadChannel(channel, UPLOAD, localId);
}

export const createUploadChannel = (action, apiMethod) =>
    eventChannel(emitter => {
        const onProgress = e => {
            if (e.lengthComputable) {
                emitter({ progress: e.percent });
            }
        };

        const onSuccess = response => {
            emitter({ response });
            emitter(END);
        };

        const onFailure = err => {
            emitter({ err });
            emitter(END);
        };

        apiMethod({
            ...action,
            onProgress,
            onSuccess,
            onFailure
        });

        return noop;
    }, buffers.sliding(2));

export function* watchUploadChannel(channel, actionType, localId) {
    while (true) {
        const { progress = 0, response, err } = yield take(channel);

        if (err) {
            return yield putGenericError(actionType, err);
        }

        if (response) {
            return yield put({ type: actionType.SUCCEEDED, data: response.body });
        }

        yield put(uploadProgress(localId, progress));
    }
}
