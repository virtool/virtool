import * as otusAPI from "../otus/api";
import { apiCall, setPending } from "../sagaUtils";
import { GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD, TEST_PROXY } from "../actionTypes";
import * as settingsAPI from "./api";
import { takeEvery, takeLatest, throttle } from "redux-saga/effects";

export function* watchSettings() {
    yield throttle(120, GET_CONTROL_READAHEAD.REQUESTED, getControlReadahead);
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
    yield takeLatest(TEST_PROXY.REQUESTED, testProxy);
    yield takeEvery(UPDATE_SETTINGS.REQUESTED, updateSettings);
}

function* getSettings(action) {
    yield apiCall(settingsAPI.get, action, GET_SETTINGS);
}

function* updateSettings(action) {
    yield setPending(
        apiCall(settingsAPI.update, action, UPDATE_SETTINGS, {
            update: action.update
        })
    );
}

function* testProxy() {
    yield apiCall(settingsAPI.proxy, {}, TEST_PROXY);
}

function* getControlReadahead(action) {
    yield setPending(apiCall(otusAPI.listNames, action, GET_CONTROL_READAHEAD));
}
