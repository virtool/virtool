import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import settingsAPI from "./api";
import virusesAPI from "../viruses/api";
import { setPending } from "../sagaHelpers";
import { GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD } from "../actionTypes";

function* getSettings () {
    try {
        const response = yield settingsAPI.get();
        yield put({type: GET_SETTINGS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SETTINGS.FAILED}, error);
    }
}

function* updateSettings (action) {
    yield setPending(function* () {
        try {
            const response = yield settingsAPI.update(action.update);
            yield put({
                type: UPDATE_SETTINGS.SUCCEEDED,
                settings: response.body,
                key: action.key,
                update: action.update
            });
        } catch (error) {
            yield put({type: UPDATE_SETTINGS.FAILED, key: action.key});
        }
    }, action);
}

function* getControlReadahead () {
    try {
        const response = yield virusesAPI.listNames();
        yield put({type: GET_CONTROL_READAHEAD.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_CONTROL_READAHEAD.FAILED});
    }
}

export function* watchSettings () {
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
    yield takeEvery(UPDATE_SETTINGS.REQUESTED, updateSettings);
    yield throttle(120, GET_CONTROL_READAHEAD.REQUESTED, getControlReadahead);
}
