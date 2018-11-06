import { push } from "react-router-redux";

import { apiCall, putGenericError, setPending } from "../utils/sagas";
import {
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
    REVERT
} from "../app/actionTypes";
import * as otusAPI from "./api";
import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

export function* updateAndGetOTU(apiMethod, action, actionType) {
    yield setPending(
        (function*(action) {
            try {
                yield apiMethod(action);
                const response = yield otusAPI.get(action);
                yield put({ type: actionType.SUCCEEDED, data: response.body });
            } catch (err) {
                yield putGenericError(actionType, err);
            }
        })(action)
    );
}

export function* findOTUs(action) {
    yield apiCall(otusAPI.find, action, FIND_OTUS);
}

export function* getOTU(action) {
    yield apiCall(otusAPI.get, action, GET_OTU);
}

export function* getOTUHistory(action) {
    yield apiCall(otusAPI.getHistory, action, GET_OTU_HISTORY);
}

export function* createOTU(action) {
    const extraFunc = { closeModal: put(push({ state: { createOTU: false } })) };
    yield setPending(apiCall(otusAPI.create, action, CREATE_OTU, {}, extraFunc));
}

export function* editOTU(action) {
    yield setPending(apiCall(otusAPI.edit, action, EDIT_OTU));
}

export function* setIsolateAsDefault(action) {
    yield updateAndGetOTU(otusAPI.setIsolateAsDefault, action, SET_ISOLATE_AS_DEFAULT);
}

export function* removeOTU(action) {
    const extraFunc = {
        goBack: put(push(`/refs/${action.refId}/otus`))
    };
    yield setPending(apiCall(otusAPI.remove, action, REMOVE_OTU, {}, extraFunc));
}

export function* addIsolate(action) {
    yield updateAndGetOTU(otusAPI.addIsolate, action, ADD_ISOLATE);
}

export function* editIsolate(action) {
    yield updateAndGetOTU(otusAPI.editIsolate, action, EDIT_ISOLATE);
}

export function* removeIsolate(action) {
    yield updateAndGetOTU(otusAPI.removeIsolate, action, REMOVE_ISOLATE);
}

export function* addSequence(action) {
    yield updateAndGetOTU(otusAPI.addSequence, action, ADD_SEQUENCE);
}

export function* editSequence(action) {
    yield updateAndGetOTU(otusAPI.editSequence, action, EDIT_SEQUENCE);
}

export function* removeSequence(action) {
    yield updateAndGetOTU(otusAPI.removeSequence, action, REMOVE_SEQUENCE);
}

export function* revert(action) {
    try {
        yield otusAPI.revert(action);
        const otuResponse = yield otusAPI.get(action);
        const historyResponse = yield otusAPI.getHistory(action);
        yield put({
            type: REVERT.SUCCEEDED,
            data: otuResponse.body,
            history: historyResponse.body
        });
    } catch (error) {
        yield put({ type: REVERT.FAILED, error });
    }
}

export function* watchOTUs() {
    yield throttle(300, FIND_OTUS.REQUESTED, findOTUs);
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
}
