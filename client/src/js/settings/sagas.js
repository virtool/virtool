import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as settingsAPI from "./api";
import * as virusesAPI from "../viruses/api";
import { apiCall, setPending } from "../sagaUtils";
import { GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD } from "../actionTypes";

export function* watchSettings () {
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
    yield takeEvery(UPDATE_SETTINGS.REQUESTED, updateSettings);
    yield throttle(120, GET_CONTROL_READAHEAD.REQUESTED, getControlReadahead);
}

function* getSettings (action) {
    yield apiCall(settingsAPI.get, action, GET_SETTINGS);
}

function* updateSettings (action) {
    yield setPending(function* (action) {
        try {
            const response = yield settingsAPI.update(action);
            yield put({
                type: UPDATE_SETTINGS.SUCCEEDED,
                settings: response.body,
                key: action.key,
                update: action.update
            });
        } catch (error) {
            yield put({type: UPDATE_SETTINGS.FAILED, key: action.key});
        }
    }(action));
}

function* getControlReadahead (action) {
    yield setPending(apiCall(virusesAPI.listNames, action, GET_CONTROL_READAHEAD));
}
