/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { put, takeEvery, takeLatest } from "redux-saga/effects";
import settingsAPI from "./api";
import { GET_SETTINGS, UPDATE_SETTINGS } from "../actionTypes";

export function* watchSettings () {
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
}

function* getSettings () {
    try {
        const response = yield settingsAPI.get();
        yield put({type: GET_SETTINGS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SETTINGS.FAILED}, error);
    }
}

export function* watchUpdateSettings () {
    yield takeEvery(UPDATE_SETTINGS.REQUESTED, updateSettings)
}

function* updateSettings (action) {
    try {
        const response = yield settingsAPI.update(action.update);
        yield put({type: UPDATE_SETTINGS.SUCCEEDED, settings: response.body});
    } catch(error) {
        yield put({type: UPDATE_SETTINGS.FAILED})
    }
}
