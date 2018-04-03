import { push } from "react-router-redux";
import { takeEvery, takeLatest, throttle, put } from "redux-saga/effects";

import { apiCall, setPending, putGenericError } from "../sagaUtils";
import * as usersAPI from "./api";
import {
    LIST_USERS,
    CREATE_USER,
    EDIT_USER,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../actionTypes";

function* listUsers (action) {
    yield apiCall(usersAPI.list, action, LIST_USERS);
}

function* createUser (action) {
    yield setPending(apiCustomCall(usersAPI.create, action, CREATE_USER));

    function* apiCustomCall (apiMethod, action, actionType, extra = {}) {
        try {
            const response = yield apiMethod(action);
            yield put({type: actionType.SUCCEEDED, data: response.body, ...extra});

            // Close the create user modal and navigate to the new user.
            yield put(push(`/settings/users/${action.userId}`, {state: {createUser: false}}));
        } catch (error) {
            yield putGenericError(actionType, error);
        }
    }
}

function* editUser (action) {
    yield setPending(apiCall(usersAPI.edit, action, EDIT_USER));
}

function* addToGroup (action) {
    yield setPending(apiCall(usersAPI.addUserToGroup, action, ADD_USER_TO_GROUP, {id: action.userId}));
}

function* removeFromGroup (action) {
    yield setPending(apiCall(usersAPI.removeUserFromGroup, action, REMOVE_USER_FROM_GROUP, {id: action.userId}));
}

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield throttle(200, CREATE_USER.REQUESTED, createUser);
    yield takeEvery(EDIT_USER.REQUESTED, editUser);
    yield takeEvery(ADD_USER_TO_GROUP.REQUESTED, addToGroup);
    yield takeEvery(REMOVE_USER_FROM_GROUP.REQUESTED, removeFromGroup);
}
