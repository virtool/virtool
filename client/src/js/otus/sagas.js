import { LOCATION_CHANGE, push } from "react-router-redux";
import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as filesAPI from "../files/api";
import * as otusAPI from "./api";
import {apiCall, apiFind, putGenericError, setPending} from "../sagaUtils";
import {
    FETCH_OTUS,
    FIND_OTUS,
    GET_OTU,
    GET_OTU_HISTORY,
    CREATE_OTU,
    EDIT_OTU,
    REMOVE_OTU,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
    UPLOAD_IMPORT,
    COMMIT_IMPORT
} from "../actionTypes";

export function* updateAndGetOTU (apiMethod, action, actionType) {
    yield setPending((function* (action) {
        try {
            yield apiMethod(action);
            const response = yield otusAPI.get(action);
            yield put({type: actionType.SUCCEEDED, data: response.body});
        } catch (err) {
            yield putGenericError(actionType, err);
        }
    })(action));
}

export function* fetchOTUs () {
    yield apiCall(otusAPI.find, {}, FIND_OTUS);
}

export function* findOTUs (action) {
    yield apiFind("/otus", otusAPI.find, action, FIND_OTUS);
}

export function* getOTU (action) {
    yield apiCall(otusAPI.get, action, GET_OTU);
}

export function* getOTUHistory (action) {
    yield apiCall(otusAPI.getHistory, action, GET_OTU_HISTORY);
}

export function* createOTU (action) {
    yield setPending(apiCustomCall(otusAPI.create, action, CREATE_OTU));

    function* apiCustomCall (apiMethod, action, actionType, extra = {}) {
        try {
            const response = yield apiMethod(action);
            yield put({type: actionType.SUCCEEDED, data: response.body, ...extra});
            yield put(push({state: {createOTU: false}}));
        } catch (error) {
            yield putGenericError(actionType, error);
        }
    }
}

export function* editOTU (action) {
    yield setPending(apiCall(otusAPI.edit, action, EDIT_OTU));
}

export function* setIsolateAsDefault (action) {
    yield updateAndGetOTU(otusAPI.setIsolateAsDefault, action, SET_ISOLATE_AS_DEFAULT);
}

export function* removeOTU (action) {
    yield setPending(apiCall(otusAPI.remove, action, REMOVE_OTU));
    yield put(push("/otus"));
}

export function* addIsolate (action) {
    yield updateAndGetOTU(otusAPI.addIsolate, action, ADD_ISOLATE);
}

export function* editIsolate (action) {
    yield updateAndGetOTU(otusAPI.editIsolate, action, EDIT_ISOLATE);
}

export function* removeIsolate (action) {
    yield updateAndGetOTU(otusAPI.removeIsolate, action, REMOVE_ISOLATE);
}

export function* addSequence (action) {
    yield updateAndGetOTU(otusAPI.addSequence, action, ADD_SEQUENCE);
}

export function* editSequence (action) {
    yield updateAndGetOTU(otusAPI.editSequence, action, EDIT_SEQUENCE);
}

export function* removeSequence (action) {
    yield updateAndGetOTU(otusAPI.removeSequence, action, REMOVE_SEQUENCE);
}

export function* revert (action) {
    try {
        yield otusAPI.revert(action);
        const otuResponse = yield otusAPI.get(action);
        const historyResponse = yield otusAPI.getHistory(action);
        yield put({type: REVERT.SUCCEEDED, data: otuResponse.body, history: historyResponse.body});
    } catch (error) {
        yield put({type: REVERT.FAILED, error});
    }
}

export function* uploadImport (action) {
    try {
        const uploadResponse = yield filesAPI.upload({
            file: action.file,
            fileType: "otus",
            onProgress: action.onProgress
        });
        const getResponse = yield otusAPI.getImport({fileId: uploadResponse.body.id});
        yield put({type: UPLOAD_IMPORT.SUCCEEDED, data: getResponse.body});
    } catch (error) {
        yield put({type: UPLOAD_IMPORT.FAILED, error});
    }
}

export function* commitImport (action) {
    yield setPending(apiCall(otusAPI.commitImport, action, COMMIT_IMPORT));
}

export function* watchOTUs () {
    yield throttle(300, LOCATION_CHANGE, findOTUs);
    yield takeLatest(FETCH_OTUS, fetchOTUs);
    yield takeLatest(GET_OTU.REQUESTED, getOTU);
    yield takeLatest(GET_OTU_HISTORY.REQUESTED, getOTUHistory);
    yield takeEvery(CREATE_OTU.REQUESTED, createOTU);
    yield takeEvery(EDIT_OTU.REQUESTED, editOTU);
    yield takeEvery(REMOVE_OTU.REQUESTED, removeOTU);
    yield takeEvery(ADD_ISOLATE.REQUESTED, addIsolate);
    yield takeEvery(EDIT_ISOLATE.REQUESTED, editIsolate);
    yield takeEvery(SET_ISOLATE_AS_DEFAULT.REQUESTED, setIsolateAsDefault);
    yield takeEvery(REMOVE_ISOLATE.REQUESTED, removeIsolate);
    yield takeEvery(ADD_SEQUENCE.REQUESTED, addSequence);
    yield takeEvery(EDIT_SEQUENCE.REQUESTED, editSequence);
    yield takeEvery(REMOVE_SEQUENCE.REQUESTED, removeSequence);
    yield takeEvery(REVERT.REQUESTED, revert);
    yield takeLatest(UPLOAD_IMPORT.REQUESTED, uploadImport);
    yield takeLatest(COMMIT_IMPORT.REQUESTED, commitImport);
}
