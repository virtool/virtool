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
    ADD_ISOLATE,
    EDIT_ISOLATE,
    REMOVE_ISOLATE,
    SET_APP_PENDING,
    UNSET_APP_PENDING
}  from "../actionTypes";

export function* watchViruses () {
    yield takeLatest(FIND_VIRUSES.REQUESTED, findViruses);
    yield takeLatest(GET_VIRUS.REQUESTED, getVirus);
    yield takeLatest(GET_VIRUS_HISTORY.REQUESTED, getVirusHistory);
    yield takeEvery(CREATE_VIRUS.REQUESTED, createVirus);
    yield takeEvery(ADD_ISOLATE.REQUESTED, addIsolate);
    yield takeEvery(EDIT_ISOLATE.REQUESTED, editIsolate);
    yield takeEvery(REMOVE_ISOLATE.REQUESTED, removeIsolate);
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
    });
}

export function* addIsolate (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(virusesAPI.addIsolate, action.virusId, action.sourceType, action.sourceName);
            yield put({type: ADD_ISOLATE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: ADD_ISOLATE.FAILED, error: error});
        }
    }, action);
}

export function* editIsolate (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(
                virusesAPI.editIsolate,
                action.virusId,
                action.isolateId,
                action.sourceType,
                action.sourceName
            );

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
            yield put({type: REMOVE_ISOLATE.SUCCEEDED, virusId: action.virusId, isolateId: action.isolateId});
        } catch (error) {
            yield put({type: REMOVE_ISOLATE.FAILED, error: error});
        }
    }, action);
}

