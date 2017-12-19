import { call, put, takeEvery, takeLatest } from "redux-saga/effects";

import accountAPI from "./api";
import { setPending } from "../sagaHelpers";
import {
    GET_ACCOUNT,
    GET_ACCOUNT_SETTINGS,
    UPDATE_ACCOUNT_SETTINGS,
    CHANGE_ACCOUNT_PASSWORD,
    GET_API_KEYS,
    CREATE_API_KEY,
    UPDATE_API_KEY,
    REMOVE_API_KEY,
    LOGOUT
} from "../actionTypes";

export function* watchAccount () {
    yield takeLatest(GET_ACCOUNT.REQUESTED, getAccount);
    yield takeLatest(GET_ACCOUNT_SETTINGS.REQUESTED, getAccountSettings);
    yield takeLatest(UPDATE_ACCOUNT_SETTINGS.REQUESTED, updateAccountSettings);
    yield takeLatest(CHANGE_ACCOUNT_PASSWORD.REQUESTED, changeAccountPassword);
    yield takeLatest(GET_API_KEYS.REQUESTED, getAPIKeys);
    yield takeEvery(CREATE_API_KEY.REQUESTED, createAPIKey);
    yield takeEvery(UPDATE_API_KEY.REQUESTED, updateAPIKey);
    yield takeEvery(REMOVE_API_KEY.REQUESTED, removeAPIKey);
    yield takeEvery(LOGOUT.REQUESTED, logout);
}

export function* getAccount () {
    try {
        const response = yield accountAPI.get();
        yield put({type: GET_ACCOUNT.SUCCEEDED, data: response.body});
    } catch (err) {
        yield put({type: GET_ACCOUNT.FAILED});
    }
}

export function* getAccountSettings () {
    try {
        const response = yield accountAPI.getSettings();
        yield put({type: GET_ACCOUNT_SETTINGS.SUCCEEDED, data: response.body});
    } catch (err) {
        yield put({type: GET_ACCOUNT_SETTINGS.FAILED});
    }
}

export function* updateAccountSettings (action) {
    yield setPending(function* () {
        try {
            const response = yield accountAPI.updateSettings(action.update);
            yield put({type: UPDATE_ACCOUNT_SETTINGS.SUCCEEDED, data: response.body});
        } catch (err) {
            yield put({type: UPDATE_ACCOUNT_SETTINGS.FAILED});
        }
    }, action);
}

export function* changeAccountPassword (action) {
    yield setPending(function* () {
        try {
            // Make the API call.
            yield accountAPI.changePassword(action.oldPassword, action.newPassword);

            // Refresh the account data by getting it from the API. The password change time should change in the UI.
            yield put({type: GET_ACCOUNT.REQUESTED});
        } catch (err) {
            // The only handled error should be when the old password is wrong. Other new password issue are dealt
            // with before making the request.
            if (err.response.body.message !== "Invalid old password") {
                throw (err);
            }

            // The UI shows the 'Old password is invalid' message.
            yield put({type: CHANGE_ACCOUNT_PASSWORD.FAILED});
        }
    }, action);
}

export function* getAPIKeys () {
    try {
        const response = yield accountAPI.getAPIKeys();
        yield put({type: GET_API_KEYS.SUCCEEDED, data: response.body});
    } catch (err) {
        yield put({type: CREATE_API_KEY.FAILED});
    }
}

export function* createAPIKey (action) {
    try {
        const response = yield accountAPI.createAPIKey(action.name, action.permissions);
        action.callback(response.body.key);
        yield put({type: GET_API_KEYS.REQUESTED});
    } catch (error) {
        yield put({type: CREATE_API_KEY.FAILED}, error);
    }
}

export function* updateAPIKey (action) {
    yield setPending(function* () {
        try {
            yield accountAPI.updateAPIKey(action.keyId, action.permissions);
            yield put({type: GET_API_KEYS.REQUESTED});
        } catch (error) {
            yield put({type: UPDATE_API_KEY.FAILED}, error);
        }
    }, action);
}

export function* removeAPIKey (action) {
    yield setPending(function* () {
        try {
            yield accountAPI.removeAPIKey(action.keyId);
            yield put({type: GET_API_KEYS.REQUESTED});
        } catch (error) {
            yield put({type: REMOVE_API_KEY.FAILED}, error);
        }
    }, action);
}

export function* logout () {
    yield accountAPI.logout();
    yield call(window.location.reload);
}
