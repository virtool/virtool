/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { put, takeLatest } from "redux-saga/effects";
import usersAPI from "./api";
import { LIST_USERS, SET_FORCE_RESET } from "../../actionTypes";

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield takeLatest(SET_FORCE_RESET.REQUESTED, setForceReset);
}

function* listUsers () {
    try {
        const response = yield usersAPI.list();
        yield put({type: LIST_USERS.SUCCEEDED, users: response.body});
    } catch (error) {
        yield put({type: LIST_USERS.FAILED}, error);
    }
}

function* setForceReset (action) {
    try {
        const response = yield usersAPI.setForceReset(action.userId, action.enabled);
        yield put({type: SET_FORCE_RESET.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: SET_FORCE_RESET.FAILED});
    }
}
