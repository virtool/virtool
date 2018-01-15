import { push } from "react-router-redux";
import { takeEvery, takeLatest, throttle, put } from "redux-saga/effects";

import { apiCall, setPending } from "../sagaUtils";
import * as usersAPI from "./api";
import {
    LIST_USERS,
    CREATE_USER,
    SET_PASSWORD,
    SET_FORCE_RESET,
    SET_PRIMARY_GROUP,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../actionTypes";

function* listUsers (action) {
    yield apiCall(usersAPI.list, action, LIST_USERS);
}

function* createUser (action) {
    yield setPending(apiCall(usersAPI.create, action, CREATE_USER));

    // Close the create user modal and navigate to the new user.
    yield put(push(`/settings/users/${action.userId}`, {state: {createUser: false}}));
}

function* setPassword (action) {
    yield setPending(apiCall(usersAPI.setPassword, action, SET_PASSWORD));
}

function* setForceReset (action) {
    yield setPending(apiCall(usersAPI.setForceReset, action, SET_FORCE_RESET));
}

function* setPrimaryGroup (action) {
    yield setPending(apiCall(usersAPI.setPrimaryGroup, action, SET_PRIMARY_GROUP));
}

function* addToGroup (action) {
    yield setPending(apiCall(usersAPI.addUserToGroup, action, ADD_USER_TO_GROUP));
}

function* removeFromGroup (action) {
    yield setPending(apiCall(usersAPI.removeUserFromGroup, action, REMOVE_USER_FROM_GROUP));
}

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield throttle(200, CREATE_USER.REQUESTED, createUser);
    yield takeLatest(SET_PASSWORD.REQUESTED, setPassword);
    yield takeLatest(SET_FORCE_RESET.REQUESTED, setForceReset);
    yield takeLatest(SET_PRIMARY_GROUP.REQUESTED, setPrimaryGroup);
    yield takeEvery(ADD_USER_TO_GROUP.REQUESTED, addToGroup);
    yield takeEvery(REMOVE_USER_FROM_GROUP.REQUESTED, removeFromGroup);
}
