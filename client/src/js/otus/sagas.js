import { push } from "connected-react-router";
import { put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import { pushState } from "../app/actions";
import {
    ADD_ISOLATE,
    ADD_SEQUENCE,
    CREATE_OTU,
    EDIT_ISOLATE,
    EDIT_OTU,
    EDIT_SEQUENCE,
    FIND_OTUS,
    GET_OTU,
    GET_OTU_HISTORY,
    REMOVE_ISOLATE,
    REMOVE_OTU,
    REMOVE_SEQUENCE,
    REVERT,
    SET_ISOLATE_AS_DEFAULT
} from "../app/actionTypes";
import { apiCall, pushFindTerm, putGenericError, setPending } from "../utils/sagas";
import * as otusAPI from "./api";

const getCurrentOTUsPath = state => `/refs/${state.references.detail.id}/otus`;

export function* updateAndGetOTU(apiMethod, action, actionType) {
    let response;

    try {
        response = yield apiMethod(action);
    } catch (err) {
        yield putGenericError(actionType, err);
        response = err.response;
    }

    const getResponse = yield otusAPI.get(action);
    yield put({ type: actionType.SUCCEEDED, data: getResponse.body });

    return response;
}

export function* findOTUs(action) {
    yield apiCall(otusAPI.find, action, FIND_OTUS);
    yield pushFindTerm(action.term);
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
    const response = yield updateAndGetOTU(otusAPI.addSequence, action, ADD_SEQUENCE);

    if (response.ok) {
        yield put(pushState({ addSequence: false }));
    }
}

export function* editSequence(action) {
    const response = yield updateAndGetOTU(otusAPI.editSequence, action, EDIT_SEQUENCE);

    if (response.ok) {
        yield put(pushState({ editSequence: false }));
    }
}

export function* removeSequence(action) {
    yield updateAndGetOTU(otusAPI.removeSequence, action, REMOVE_SEQUENCE);
}

export function* revert(action) {
    try {
        yield otusAPI.revert(action);

        if (action.otuVersion === 0) {
            const path = yield select(getCurrentOTUsPath);
            yield put(push(path));
        } else {
            const otuResponse = yield otusAPI.get(action);
            const historyResponse = yield otusAPI.getHistory(action);
            yield put({
                type: REVERT.SUCCEEDED,
                data: otuResponse.body,
                history: historyResponse.body
            });
        }
    } catch (error) {
        yield put({ type: REVERT.FAILED, error });
    }
}

export function* watchOTUs() {
    yield throttle(500, FIND_OTUS.REQUESTED, findOTUs);
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
