/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";
import usersAPI from "./api";
import { LIST_USERS, SET_PASSWORD, SET_FORCE_RESET, SET_PRIMARY_GROUP } from "../../actionTypes";

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield takeLatest(SET_PASSWORD.REQUESTED, setPassword);
    yield takeLatest(SET_FORCE_RESET.REQUESTED, setForceReset);
    yield takeLatest(SET_PRIMARY_GROUP.REQUESTED, setPrimaryGroup);
}

function* listUsers () {
    try {
        const response = yield call(usersAPI.list);
        yield put({type: LIST_USERS.SUCCEEDED, users: response.body});
    } catch (error) {
        yield put({type: LIST_USERS.FAILED}, error);
    }
}

function* setPassword (action) {
    if (action.password === action.confirm) {
        try {
            const response = yield call(usersAPI.setPassword, action.userId, action.password);
            yield put({type: SET_PASSWORD.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: SET_PASSWORD.FAILED});
        }
    } else {
        yield put({type: SET_PASSWORD.FAILED, error: "Passwords don't match"});
    }
}

function* setForceReset (action) {
    try {
        const response = yield call(usersAPI.setForceReset, action.userId, action.enabled);
        yield put({type: SET_FORCE_RESET.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: SET_FORCE_RESET.FAILED});
    }
}

function* setPrimaryGroup (action) {
    try {
        const response = yield call(usersAPI.setPrimaryGroup, action.userId, action.primaryGroup);
        yield put({type: SET_PRIMARY_GROUP.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: SET_PRIMARY_GROUP.FAILED, error: error});
    }
}
