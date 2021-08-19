import { put, takeEvery, takeLatest } from "redux-saga/effects";
import {
    CHANGE_ACCOUNT_PASSWORD,
    CREATE_API_KEY,
    GET_ACCOUNT,
    GET_ACCOUNT_SETTINGS,
    GET_API_KEYS,
    LOGIN,
    LOGOUT,
    REMOVE_API_KEY,
    RESET_PASSWORD,
    UPDATE_ACCOUNT,
    UPDATE_ACCOUNT_SETTINGS,
    UPDATE_API_KEY
} from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as accountAPI from "./api";

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
    yield apiCall(accountAPI.update, action, UPDATE_ACCOUNT);
}

export function* updateAccountSettings(action) {
    yield apiCall(accountAPI.updateSettings, action, UPDATE_ACCOUNT_SETTINGS);
}

export function* changeAccountPassword(action) {
    yield apiCall(accountAPI.changePassword, action, CHANGE_ACCOUNT_PASSWORD);
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
    yield apiCall(accountAPI.updateAPIKey, action, UPDATE_API_KEY);
    yield put({ type: GET_API_KEYS.REQUESTED });
}

export function* removeAPIKey(action) {
    yield apiCall(accountAPI.removeAPIKey, action, REMOVE_API_KEY);
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
