/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeEvery, takeLatest } from "redux-saga/effects";

import virusesAPI from "./api";
import { setPending } from "../wrappers";
import {
    FIND_VIRUSES,
    GET_VIRUS,
    GET_VIRUS_HISTORY,
    CREATE_VIRUS,
    EDIT_VIRUS,
    REMOVE_VIRUS,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
    SET_APP_PENDING,
    UNSET_APP_PENDING
}  from "../actionTypes";

export function* watchViruses () {
    yield takeLatest(FIND_VIRUSES.REQUESTED, findViruses);
    yield takeLatest(GET_VIRUS.REQUESTED, getVirus);
    yield takeLatest(GET_VIRUS_HISTORY.REQUESTED, getVirusHistory);
    yield takeEvery(CREATE_VIRUS.REQUESTED, createVirus);
    yield takeEvery(EDIT_VIRUS.REQUESTED, editVirus);
    yield takeEvery(REMOVE_VIRUS.REQUESTED, removeVirus);
    yield takeEvery(ADD_ISOLATE.REQUESTED, addIsolate);
    yield takeEvery(EDIT_ISOLATE.REQUESTED, editIsolate);
    yield takeEvery(REMOVE_ISOLATE.REQUESTED, removeIsolate);
    yield takeEvery(ADD_SEQUENCE.REQUESTED, addSequence);
    yield takeEvery(REMOVE_SEQUENCE.REQUESTED, removeSequence);
    yield takeEvery(REVERT.REQUESTED, revert);
}

export function* findViruses (action) {
    yield put({type: SET_APP_PENDING});

    try {
        const response = yield call(virusesAPI.find, action.term, action.page);
        yield put({type: FIND_VIRUSES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_VIRUSES.FAILED}, error);
    }

    yield put({type: UNSET_APP_PENDING});
}

export function* getVirus (action) {
    yield setPending(function* () {
        try {
            const response = yield call(virusesAPI.get, action.virusId);
            yield put({type: GET_VIRUS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: GET_VIRUS.FAILED, error: error});
        }
    }, action);
}

export function* getVirusHistory (action) {
    yield setPending(function* () {
        try {
            const response = yield call(virusesAPI.getHistory, action.virusId);
            yield put({type: GET_VIRUS_HISTORY.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: GET_VIRUS_HISTORY.FAILED, error: error});
        }
    }, action);
}

export function* createVirus (action) {
    yield setPending(function* () {
        try {
            const response = yield call(virusesAPI.create, action.name, action.abbreviation);
            yield put({type: CREATE_VIRUS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: CREATE_VIRUS.FAILED, error: error});
        }
    }, action);
}

export function* editVirus (action) {
    yield setPending(function* (action) {
        try {
            yield virusesAPI.edit(action.virusId, action.name, action.abbreviation);
            const response = yield virusesAPI.get(action.virusId);
            yield put({type: EDIT_VIRUS.SUCCEEDED, data: response.body});
        } catch (error) {
            if (error.response.status === 409) {
                yield put({type: EDIT_VIRUS.FAILED, message: error.response.body.message});
            } else{
                throw error;
            }
        }
    }, action);
}

export function* removeVirus (action) {
    yield setPending(function* () {
        try {
            yield call(virusesAPI.remove, action.virusId);
            yield call(action.history.push, "/viruses");
            yield put({type: REMOVE_VIRUS.SUCCEEDED});
        } catch (error) {
            yield put({type: REMOVE_VIRUS.FAILED, error: error});
        }
    });
}

export function* addIsolate (action) {
    yield setPending(function* (action) {
        try {
            yield call(virusesAPI.addIsolate, action.virusId, action.sourceType, action.sourceName);
            const response = yield call(virusesAPI.get, action.virusId);
            yield put({type: ADD_ISOLATE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: ADD_ISOLATE.FAILED, error: error});
        }
    }, action);
}

export function* editIsolate (action) {
    yield setPending(function* (action) {
        try {
            yield call(virusesAPI.editIsolate, action.virusId, action.isolateId, action.sourceType, action.sourceName);
            const response = yield call(virusesAPI.get, action.virusId);
            yield put({type: EDIT_ISOLATE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: EDIT_ISOLATE.FAILED, error: error});
        }
    }, action);
}

export function* removeIsolate (action) {
    yield setPending(function* (action) {
        try {
            yield call(virusesAPI.removeIsolate, action.virusId, action.isolateId);
            yield call(action.onSuccess);
            const response = yield call(virusesAPI.get, action.virusId);
            yield put({type: REMOVE_ISOLATE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: REMOVE_ISOLATE.FAILED, error: error});
        }
    }, action);
}

export function* addSequence (action) {
    yield setPending(function* (action) {
        try {
            yield call(
                virusesAPI.addSequence,
                action.virusId,
                action.isolateId,
                action.sequenceId,
                action.definition,
                action.host,
                action.sequence
            );
            const response = yield call(virusesAPI.get, action.virusId);
            yield put({type: ADD_SEQUENCE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: ADD_SEQUENCE.FAILED, error: error});
        }
    }, action);
}

export function* removeSequence (action) {
    yield setPending(function* (action) {
        try {
            yield call(virusesAPI.removeSequence, action.virusId, action.isolateId, action.sequenceId);
            const response = yield call(virusesAPI.get, action.virusId);
            yield put({type: REMOVE_SEQUENCE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: REMOVE_SEQUENCE.FAILED, error: error});
        }
    }, action);
}

export function* revert (action) {
    yield setPending(function* (action) {
        try {
            yield call(virusesAPI.revert, action.virusId, action.version);

            const virusResponse = yield call(virusesAPI.get, action.virusId);
            const historyResponse = yield call(virusesAPI.getHistory, action.virusId);

            yield put({type: REVERT.SUCCEEDED, detail: virusResponse.body, history: historyResponse.body});
        } catch (error) {
            yield put({type: REVERT.FAILED, error: error});
        }
    }, action)
}
