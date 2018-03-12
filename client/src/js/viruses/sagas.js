import { LOCATION_CHANGE, push } from "react-router-redux";
import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as filesAPI from "../files/api";
import * as virusesAPI from "./api";
import {apiCall, apiFind, putGenericError, setPending} from "../sagaUtils";
import {
    FETCH_VIRUSES,
    FIND_VIRUSES,
    GET_VIRUS,
    GET_VIRUS_HISTORY,
    CREATE_VIRUS,
    EDIT_VIRUS,
    REMOVE_VIRUS,
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

export function* updateAndGetVirus (apiMethod, action, actionType) {
    yield setPending((function* (action) {
        try {
            yield apiMethod(action);
            const response = yield virusesAPI.get(action);
            yield put({type: actionType.SUCCEEDED, data: response.body});
        } catch (err) {
            yield putGenericError(actionType, err);
        }
    })(action));
}

export function* fetchViruses () {
    yield apiCall(virusesAPI.find, {}, FIND_VIRUSES);
}

export function* findViruses (action) {
    yield apiFind("/viruses", virusesAPI.find, action, FIND_VIRUSES);
}

export function* getVirus (action) {
    yield apiCall(virusesAPI.get, action, GET_VIRUS);
}

export function* getVirusHistory (action) {
    yield apiCall(virusesAPI.getHistory, action, GET_VIRUS_HISTORY);
}

export function* createVirus (action) {
    yield setPending(apiCall(virusesAPI.create, action, CREATE_VIRUS));
}

export function* editVirus (action) {
    yield setPending(apiCall(virusesAPI.edit, action, EDIT_VIRUS));
}

export function* setIsolateAsDefault (action) {
    yield updateAndGetVirus(virusesAPI.setIsolateAsDefault, action, SET_ISOLATE_AS_DEFAULT);
}

export function* removeVirus (action) {
    yield setPending(apiCall(virusesAPI.remove, action, REMOVE_VIRUS));
    yield put(push("/viruses"));
}

export function* addIsolate (action) {
    yield updateAndGetVirus(virusesAPI.addIsolate, action, ADD_ISOLATE);
}

export function* editIsolate (action) {
    yield updateAndGetVirus(virusesAPI.editIsolate, action, EDIT_ISOLATE);
}

export function* removeIsolate (action) {
    yield updateAndGetVirus(virusesAPI.removeIsolate, action, REMOVE_ISOLATE);
}

export function* addSequence (action) {
    yield updateAndGetVirus(virusesAPI.addSequence, action, ADD_SEQUENCE);
}

export function* editSequence (action) {
    yield updateAndGetVirus(virusesAPI.editSequence, action, EDIT_SEQUENCE);
}

export function* removeSequence (action) {
    yield updateAndGetVirus(virusesAPI.removeSequence, action, REMOVE_SEQUENCE);
}

export function* revert (action) {
    try {
        yield virusesAPI.revert(action);
        const virusResponse = yield virusesAPI.get(action);
        const historyResponse = yield virusesAPI.getHistory(action);
        yield put({type: REVERT.SUCCEEDED, data: virusResponse.body, history: historyResponse.body});
    } catch (error) {
        yield put({type: REVERT.FAILED, error});
    }
}

export function* uploadImport (action) {
    try {
        const uploadResponse = yield filesAPI.upload({
            file: action.file,
            fileType: "viruses",
            onProgress: action.onProgress
        });
        const getResponse = yield virusesAPI.getImport({fileId: uploadResponse.body.id});
        yield put({type: UPLOAD_IMPORT.SUCCEEDED, data: getResponse.body});
    } catch (error) {
        yield put({type: UPLOAD_IMPORT.FAILED, error});
    }
}

export function* commitImport (action) {
    yield setPending(apiCall(virusesAPI.commitImport, action, COMMIT_IMPORT));
}

export function* watchViruses () {
    yield throttle(300, LOCATION_CHANGE, findViruses);
    yield takeLatest(FETCH_VIRUSES, fetchViruses);
    yield takeLatest(GET_VIRUS.REQUESTED, getVirus);
    yield takeLatest(GET_VIRUS_HISTORY.REQUESTED, getVirusHistory);
    yield takeEvery(CREATE_VIRUS.REQUESTED, createVirus);
    yield takeEvery(EDIT_VIRUS.REQUESTED, editVirus);
    yield takeEvery(REMOVE_VIRUS.REQUESTED, removeVirus);
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
