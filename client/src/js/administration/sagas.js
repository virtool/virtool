import { takeEvery, takeLatest, throttle } from "redux-saga/effects";
import { GET_CONTROL_READAHEAD, GET_SETTINGS, UPDATE_SETTINGS } from "../app/actionTypes";
import * as otusAPI from "../otus/api";
import { apiCall, setPending } from "../utils/sagas";
import * as settingsAPI from "./api";

export function* watchSettings() {
    yield throttle(120, GET_CONTROL_READAHEAD.REQUESTED, getControlReadahead);
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
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

function* getControlReadahead(action) {
    yield setPending(apiCall(otusAPI.listNames, action, GET_CONTROL_READAHEAD));
}
