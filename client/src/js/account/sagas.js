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
import { GET_ACCOUNT, GET_ACCOUNT_SETTINGS, UPDATE_ACCOUNT_SETTINGS, LOGOUT } from "../actionTypes";

export function* watchAccount () {
    yield takeLatest(GET_ACCOUNT.REQUESTED, getAccount);
    yield takeLatest(GET_ACCOUNT_SETTINGS.REQUESTED, getAccountSettings);
    yield takeLatest(UPDATE_ACCOUNT_SETTINGS.REQUESTED, updateAccountSettings);
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

export function* logout () {
    yield accountAPI.logout();
    yield put({type: LOGOUT.SUCCEEDED});
}
