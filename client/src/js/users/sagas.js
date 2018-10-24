import { push } from "react-router-redux";

import { apiCall, setPending } from "../sagaUtils";
import {
  LIST_USERS,
  GET_USER,
  CREATE_USER,
  EDIT_USER,
  REMOVE_USER,
  FILTER_USERS
} from "../actionTypes";
import * as usersAPI from "./api";
import { takeEvery, takeLatest, throttle, put } from "redux-saga/effects";

function* listUsers(action) {
  yield apiCall(usersAPI.list, action, LIST_USERS);
}

function* getUser(action) {
  yield apiCall(usersAPI.get, action, GET_USER);
}

function* createUser(action) {
  const extraFunc = {
    closeModal: put(
      push(`/administration/users/${action.userId}`, {
        state: { createUser: false }
      })
    )
  };

  yield setPending(
    apiCall(usersAPI.create, action, CREATE_USER, {}, extraFunc)
  );
}

function* editUser(action) {
  yield setPending(apiCall(usersAPI.edit, action, EDIT_USER));
}

function* removeUser(action) {
  const extraFunc = {
    goBack: put(push("/administration/users"))
  };
  yield setPending(
    apiCall(usersAPI.remove, action, REMOVE_USER, {}, extraFunc)
  );
}

function* filterUsers(action) {
  yield apiCall(usersAPI.filter, action, FILTER_USERS);
}

export function* watchUsers() {
  yield takeLatest(LIST_USERS.REQUESTED, listUsers);
  yield takeEvery(GET_USER.REQUESTED, getUser);
  yield throttle(200, CREATE_USER.REQUESTED, createUser);
  yield takeEvery(EDIT_USER.REQUESTED, editUser);
  yield takeEvery(REMOVE_USER.REQUESTED, removeUser);
  yield takeLatest(FILTER_USERS.REQUESTED, filterUsers);
}
