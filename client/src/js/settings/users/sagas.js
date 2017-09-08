/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeEvery, takeLatest } from "redux-saga/effects";
import usersAPI from "./api";
import {
    LIST_USERS,
    SET_PASSWORD,
    SET_FORCE_RESET,
    SET_PRIMARY_GROUP,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP,
    SET_APP_PENDING,
    UNSET_APP_PENDING
} from "../../actionTypes";

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield takeLatest(SET_PASSWORD.REQUESTED, setPassword);
    yield takeLatest(SET_FORCE_RESET.REQUESTED, setForceReset);
    yield takeLatest(SET_PRIMARY_GROUP.REQUESTED, setPrimaryGroup);
    yield takeEvery(ADD_USER_TO_GROUP.REQUESTED, addUserToGroup);
    yield takeEvery(REMOVE_USER_FROM_GROUP.REQUESTED, removeUserFromGroup);
}

function* listUsers () {
    try {
        yield put({type: SET_APP_PENDING});
        const response = yield call(usersAPI.list);
        yield put({type: LIST_USERS.SUCCEEDED, users: response.body});
        yield put({type: UNSET_APP_PENDING});
    } catch (error) {
        yield put({type: LIST_USERS.FAILED}, error);
        yield put({type: UNSET_APP_PENDING});
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

function* addUserToGroup (action) {
    try {
        const response = yield call(usersAPI.addUserToGroup, action.userId, action.groupId);
        yield put({type: ADD_USER_TO_GROUP.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: ADD_USER_TO_GROUP.FAILED, error: error});
    }
}

function* removeUserFromGroup (action) {
    try {
        const response = yield call(usersAPI.removeUserFromGroup, action.userId, action.groupId);
        yield put({type: REMOVE_USER_FROM_GROUP.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: REMOVE_USER_FROM_GROUP.FAILED, error: error});
    }
}
