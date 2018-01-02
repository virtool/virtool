import { LOCATION_CHANGE, push } from "react-router-redux";
import { all, put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import filesAPI from "../files/api";
import virusesAPI from "./api";
import {apiCall, apiFind, setPending} from "../sagaUtils";
import {
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
    COMMIT_IMPORT,
    SELECT_ISOLATE,
    SELECT_SEQUENCE
} from "../actionTypes";

export function* getUpdatedVirus (actionType, virusId) {
    const response = yield virusesAPI.get(virusId);
    yield put({type: actionType, data: response.body});
}

export function* findViruses (action) {
    yield apiFind("/viruses", virusesAPI.find, action, FIND_VIRUSES);
}

export function* getVirus (action) {
    yield setPending(apiCall(virusesAPI.get, action, GET_VIRUS));
}

export function* getVirusHistory (action) {
    yield setPending(apiCall(virusesAPI.getHistory, action, GET_VIRUS_HISTORY));
}

export function* createVirus (action) {
    yield setPending(apiCall(virusesAPI.create, action, CREATE_VIRUS));
}

export function* editVirus (action) {
    yield setPending(apiCall(virusesAPI.edit, action, EDIT_VIRUS));
}

export function* setIsolateAsDefault (action) {
    yield setPending(apiCall(virusesAPI.setIsolateAsDefault, action, SET_ISOLATE_AS_DEFAULT));
}

export function* removeVirus (action) {
    yield setPending(apiCall(virusesAPI.remove, action, REMOVE_VIRUS));
    yield put(push("/viruses"));
}

export function* addIsolate (action) {
    yield setPending(apiCall(virusesAPI.addIsolate, action, ADD_ISOLATE));
}

export function* editIsolate (action) {
    yield setPending(apiCall(virusesAPI.editIsolate, action, EDIT_ISOLATE));
}

export function* removeIsolate (action) {
    yield setPending(function* () {
        yield apiCall(virusesAPI.removeIsolate, action, REMOVE_ISOLATE);
        yield getUpdatedVirus(REMOVE_ISOLATE.SUCCEEDED, action.virusId);
        yield all([
            put({type: SELECT_SEQUENCE, sequenceId: null}),
            put({type: SELECT_ISOLATE, isolateId: action.nextIsolateId})
        ]);
    });
}

export function* addOrEditSequence (action, apiMethod, actionTypeRoot) {
    yield setPending(function* () {
        yield apiCall(apiMethod, action, actionTypeRoot);
        yield getUpdatedVirus(actionTypeRoot.SUCCEEDED, action.virusId);
    });
}

export function* addSequence (action) {
    yield addOrEditSequence(action, virusesAPI.addSequence, ADD_SEQUENCE);
}

export function* editSequence (action) {
    yield addOrEditSequence(action, virusesAPI.editSequence, EDIT_SEQUENCE);
}

export function* removeSequence (action) {
    yield setPending(apiCall(virusesAPI.removeSequence, action, REMOVE_SEQUENCE));
}

export function* revert (action) {
    yield setPending(function* (action) {
        try {
            yield virusesAPI.revert(action);
            const virusResponse = yield virusesAPI.get(action);
            const historyResponse = yield virusesAPI.getHistory(action);
            yield put({type: REVERT.SUCCEEDED, detail: virusResponse.body, history: historyResponse.body});
        } catch (error) {
            yield put({type: REVERT.FAILED, error});
        }
    }, action);
}

export function* uploadImport (action) {
    try {
        const uploadResponse = yield filesAPI.upload(action.file, "viruses", action.onProgress);
        const getResponse = yield virusesAPI.getImport(uploadResponse.body.id);
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
