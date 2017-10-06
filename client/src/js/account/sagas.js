/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { put, takeEvery, takeLatest } from "redux-saga/effects";

import accountAPI from "./api";
import { setPending } from "../wrappers";
import {
    GET_ACCOUNT,
    GET_ACCOUNT_SETTINGS,
    UPDATE_ACCOUNT_SETTINGS,
    CREATE_API_KEY,
    REMOVE_API_KEY,
    LOGOUT
} from "../actionTypes";
import {UPDATE_API_KEY} from "../actionTypes";

export function* watchAccount () {
    yield takeLatest(GET_ACCOUNT.REQUESTED, getAccount);
    yield takeLatest(GET_ACCOUNT_SETTINGS.REQUESTED, getAccountSettings);
    yield takeLatest(UPDATE_ACCOUNT_SETTINGS.REQUESTED, updateAccountSettings);
    yield takeEvery(CREATE_API_KEY.REQUESTED, createAPIKey);
    yield takeEvery(UPDATE_API_KEY.REQUESTED, updateAPIKey);
    yield takeEvery(REMOVE_API_KEY.REQUESTED, removeAPIKey);
    yield takeEvery(LOGOUT.REQUESTED, logout);
}

export function* getAccount () {
    try {
        const response = yield accountAPI.get();
        yield put({type: GET_ACCOUNT.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_ACCOUNT.FAILED}, error);
    }
}

export function* getAccountSettings () {
    try {
        const response = yield accountAPI.getSettings();
        yield put({type: GET_ACCOUNT_SETTINGS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_ACCOUNT_SETTINGS.FAILED}, error);
    }
}

export function* updateAccountSettings (action) {
    yield setPending(function* () {
        try {
            const response = yield accountAPI.updateSettings(action.update);
            yield put({type: UPDATE_ACCOUNT_SETTINGS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: UPDATE_ACCOUNT_SETTINGS.FAILED}, error);
        }
    }, action);
}

export function* createAPIKey (action) {
    try {
        const response = yield accountAPI.createAPIKey(action.name, action.permissions);
        action.callback(response.body.raw);
        yield put({type: GET_ACCOUNT.REQUESTED});
    } catch (error) {
        yield put({type: CREATE_API_KEY.FAILED}, error);
    }
}

export function* updateAPIKey (action) {
    yield setPending(function* () {
        try {
            yield accountAPI.updateAPIKey(action.keyId, action.permissions);
            yield put({type: GET_ACCOUNT.REQUESTED});
        } catch (error) {
            yield put({type: UPDATE_API_KEY.FAILED}, error);
        }
    }, action);
}

export function* removeAPIKey (action) {
    yield setPending(function* () {
        try {
            yield accountAPI.removeAPIKey(action.keyId);
            yield put({type: GET_ACCOUNT.REQUESTED});
        } catch (error) {
            yield put({type: REMOVE_API_KEY.FAILED}, error);
        }
    }, action);
}

export function* logout () {
    yield accountAPI.logout();
    yield put({type: LOGOUT.SUCCEEDED});
}
