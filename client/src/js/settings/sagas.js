/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { put, takeEvery, takeLatest, select } from "redux-saga/effects";
import virusesAPI from "../viruses/api";
import settingsAPI from "./api";
import {
    GET_SETTINGS_REQUESTED,
    GET_SETTINGS_SUCCEEDED,
    GET_SETTINGS_FAILED,
    UPDATE_SETTINGS_REQUESTED,
    UPDATE_SETTINGS_SUCCEEDED,
    UPDATE_SETTINGS_FAILED,
    GET_CONTROL_READAHEAD_REQUESTED,
    GET_CONTROL_READAHEAD_SUCCEEDED,
    GET_CONTROL_READAHEAD_FAILED
} from "../actionTypes"

export function* watchSettings () {
    yield takeLatest(GET_SETTINGS_REQUESTED, getSettings);
}

function* getSettings () {
    try {
        const response = yield settingsAPI.get();
        yield put({type: GET_SETTINGS_SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SETTINGS_FAILED}, error);
    }
}

export function* watchUpdateSettings () {
    yield takeEvery(UPDATE_SETTINGS_REQUESTED, updateSettings)
}

function* updateSettings (action) {
    try {
        const response = yield settingsAPI.update(action.update);
        yield put({type: UPDATE_SETTINGS_SUCCEEDED, settings: response.body});
    } catch(error) {
        yield put({type: UPDATE_SETTINGS_FAILED})
    }
}

export function* watchReadahead () {
    yield takeLatest(GET_CONTROL_READAHEAD_REQUESTED, getReadahead)
}

function* getReadahead () {
    try {
        const term = yield select(state => state.settings.internalControl.find);
        const response = yield virusesAPI.find({find: term});
        yield put({type: GET_CONTROL_READAHEAD_SUCCEEDED, data: response.body.map(virus => virus.name)});
    } catch(error) {
        yield put({type: GET_CONTROL_READAHEAD_FAILED});
    }
}


