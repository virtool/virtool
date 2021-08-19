import { takeEvery, takeLatest } from "redux-saga/effects";
import { GET_SETTINGS, UPDATE_SETTINGS } from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as settingsAPI from "./api";

export function* watchSettings() {
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
    yield takeEvery(UPDATE_SETTINGS.REQUESTED, updateSettings);
}

function* getSettings(action) {
    yield apiCall(settingsAPI.get, action, GET_SETTINGS);
}

function* updateSettings(action) {
    yield apiCall(settingsAPI.update, action, UPDATE_SETTINGS, {
        update: action.update
    });
}
