import { push } from "react-router-redux";
import { takeEvery, takeLatest, throttle, put } from "redux-saga/effects";

import { apiCall, setPending } from "../sagaUtils";
import * as usersAPI from "./api";
import {
    LIST_USERS,
    CREATE_USER,
    EDIT_USER,
    FILTER_USERS
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
}

function* filterUsers (action) {
    yield apiCall(usersAPI.filter, action, FILTER_USERS);
}

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield throttle(200, CREATE_USER.REQUESTED, createUser);
    yield takeEvery(EDIT_USER.REQUESTED, editUser);
    yield takeLatest(FILTER_USERS.REQUESTED, filterUsers);
}
