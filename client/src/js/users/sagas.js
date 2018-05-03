import { push } from "react-router-redux";
import { takeEvery, takeLatest, throttle, put } from "redux-saga/effects";

import { apiCall, setPending, putGenericError } from "../sagaUtils";
import * as usersAPI from "./api";
import {
    LIST_USERS,
    CREATE_USER,
    EDIT_USER
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
            yield put(push(`/administration/users/${action.userId}`, {state: {createUser: false}}));
        } catch (error) {
            yield putGenericError(actionType, error);
        }
    }
}

function* editUser (action) {
    yield setPending(apiCall(usersAPI.edit, action, EDIT_USER));
}

export function* watchUsers () {
    yield takeLatest(LIST_USERS.REQUESTED, listUsers);
    yield throttle(200, CREATE_USER.REQUESTED, createUser);
    yield takeEvery(EDIT_USER.REQUESTED, editUser);
}
