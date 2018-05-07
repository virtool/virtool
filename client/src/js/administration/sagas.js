import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as settingsAPI from "./api";
import * as OTUsAPI from "../references/api";
import { apiCall, setPending, putGenericError } from "../sagaUtils";
import {GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD, TEST_PROXY} from "../actionTypes";

export function* watchSettings () {
    yield throttle(120, GET_CONTROL_READAHEAD.REQUESTED, getControlReadahead);
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
    yield takeLatest(TEST_PROXY.REQUESTED, testProxy);
    yield takeEvery(UPDATE_SETTINGS.REQUESTED, updateSettings);
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
            yield putGenericError(UPDATE_SETTINGS, error);
        }
    }(action));
}

function* testProxy () {
    yield apiCall(settingsAPI.proxy, {}, TEST_PROXY);
}

function* getControlReadahead (action) {
    yield setPending(apiCall(OTUsAPI.listNames, action, GET_CONTROL_READAHEAD));
}
