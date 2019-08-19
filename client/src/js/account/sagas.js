import { setPending, apiCall } from "../utils/sagas";
import {
    GET_ACCOUNT,
    UPDATE_ACCOUNT,
    GET_ACCOUNT_SETTINGS,
    UPDATE_ACCOUNT_SETTINGS,
    CHANGE_ACCOUNT_PASSWORD,
    GET_API_KEYS,
    CREATE_API_KEY,
    UPDATE_API_KEY,
    REMOVE_API_KEY,
    LOGOUT,
    LOGIN,
    RESET_PASSWORD
} from "../app/actionTypes";
import * as accountAPI from "./api";
import { put, takeEvery, takeLatest } from "redux-saga/effects";

export function* watchAccount() {
    yield takeLatest(GET_ACCOUNT.REQUESTED, getAccount);
    yield takeLatest(GET_ACCOUNT_SETTINGS.REQUESTED, getAccountSettings);
    yield takeLatest(UPDATE_ACCOUNT.REQUESTED, updateAccount);
    yield takeLatest(UPDATE_ACCOUNT_SETTINGS.REQUESTED, updateAccountSettings);
    yield takeLatest(CHANGE_ACCOUNT_PASSWORD.REQUESTED, changeAccountPassword);
    yield takeLatest(GET_API_KEYS.REQUESTED, getAPIKeys);
    yield takeEvery(CREATE_API_KEY.REQUESTED, createAPIKey);
    yield takeEvery(UPDATE_API_KEY.REQUESTED, updateAPIKey);
    yield takeEvery(REMOVE_API_KEY.REQUESTED, removeAPIKey);
    yield takeLatest(LOGIN.REQUESTED, login);
    yield takeEvery(LOGOUT.REQUESTED, logout);
    yield takeLatest(RESET_PASSWORD.REQUESTED, resetPassword);
}

export function* getAccount() {
    yield apiCall(accountAPI.get, {}, GET_ACCOUNT);
}

export function* getAccountSettings() {
    yield apiCall(accountAPI.getSettings, {}, GET_ACCOUNT_SETTINGS);
}

export function* updateAccount(action) {
    yield setPending(apiCall(accountAPI.update, action, UPDATE_ACCOUNT));
}

export function* updateAccountSettings(action) {
    yield setPending(apiCall(accountAPI.updateSettings, action, UPDATE_ACCOUNT_SETTINGS));
}

export function* changeAccountPassword(action) {
    yield setPending(apiCall(accountAPI.changePassword, action, CHANGE_ACCOUNT_PASSWORD));
    yield put({ type: GET_ACCOUNT.REQUESTED });
}

export function* getAPIKeys() {
    yield apiCall(accountAPI.getAPIKeys, {}, GET_API_KEYS);
}

export function* createAPIKey(action) {
    yield apiCall(accountAPI.createAPIKey, action, CREATE_API_KEY);
    yield getAPIKeys();
}

export function* updateAPIKey(action) {
    yield setPending(apiCall(accountAPI.updateAPIKey, action, UPDATE_API_KEY));
    yield put({ type: GET_API_KEYS.REQUESTED });
}

export function* removeAPIKey(action) {
    yield setPending(apiCall(accountAPI.removeAPIKey, action, REMOVE_API_KEY));
    yield put({ type: GET_API_KEYS.REQUESTED });
}

export function* login(action) {
    yield apiCall(accountAPI.login, action, LOGIN);
}

export function* logout() {
    yield apiCall(accountAPI.logout, {}, LOGOUT);
}

export function* resetPassword(action) {
    yield apiCall(accountAPI.resetPassword, action, RESET_PASSWORD);
}
