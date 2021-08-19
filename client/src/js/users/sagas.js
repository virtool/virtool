import { push } from "connected-react-router";
import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import { pushState } from "../app/actions";
import { CREATE_FIRST_USER, CREATE_USER, EDIT_USER, FIND_USERS, GET_USER, REMOVE_USER } from "../app/actionTypes";
import { apiCall, pushFindTerm } from "../utils/sagas";
import * as usersAPI from "./api";

function* findUsers(action) {
    yield apiCall(usersAPI.find, action, FIND_USERS);
    yield pushFindTerm(action.term);
}

function* getUser(action) {
    yield apiCall(usersAPI.get, action, GET_USER);
}

function* createUser(action) {
    const extraFunc = {
        closeModal: put(pushState({ createUser: false }))
    };

    yield apiCall(usersAPI.create, action, CREATE_USER, {}, extraFunc);
}

function* createFirstUser(action) {
    yield apiCall(usersAPI.createFirst, action, CREATE_FIRST_USER);
}

function* editUser(action) {
    yield apiCall(usersAPI.edit, action, EDIT_USER);
}

function* removeUser(action) {
    const extraFunc = {
        goBack: put(push("/administration/users"))
    };
    yield apiCall(usersAPI.remove, action, REMOVE_USER, {}, extraFunc);
}

export function* watchUsers() {
    yield takeLatest(FIND_USERS.REQUESTED, findUsers);
    yield takeEvery(GET_USER.REQUESTED, getUser);
    yield throttle(200, CREATE_USER.REQUESTED, createUser);
    yield takeEvery(EDIT_USER.REQUESTED, editUser);
    yield takeEvery(REMOVE_USER.REQUESTED, removeUser);
    yield takeLatest(CREATE_FIRST_USER.REQUESTED, createFirstUser);
}
