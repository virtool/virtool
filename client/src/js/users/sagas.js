import { push } from "react-router-redux";
import { takeEvery, takeLatest, throttle, put, select } from "redux-saga/effects";

import { apiCall, setPending } from "../sagaUtils";
import * as usersAPI from "./api";
import {
    GET_ACCOUNT,
    LIST_USERS,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";

function* listUsers (action) {
    yield apiCall(usersAPI.list, action, LIST_USERS);
}

function* createUser (action) {
    const extraFunc = {
        closeModal: put(push(`/administration/users/${action.userId}`, {state: {createUser: false}}))
    };

    yield setPending(apiCall(usersAPI.create, action, CREATE_USER, {}, extraFunc));
}

function* editUser (action) {
    yield setPending(apiCall(usersAPI.edit, action, EDIT_USER));

    const activeUserId = yield select(state => state.users.activeId);

    if (activeUserId === action.userId) {
        yield put({ type: LIST_USERS.REQUESTED });
        yield put({ type: GET_ACCOUNT.REQUESTED });
    }
}

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield throttle(200, CREATE_USER.REQUESTED, createUser);
    yield takeEvery(EDIT_USER.REQUESTED, editUser);
}
