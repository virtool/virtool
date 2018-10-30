import { apiCall, setPending } from "../sagaUtils";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";
import * as groupsAPI from "./api";
import { takeEvery, takeLatest, throttle } from "redux-saga/effects";

export function* watchGroups() {
    yield takeLatest(LIST_GROUPS.REQUESTED, listGroups);
    yield throttle(200, CREATE_GROUP.REQUESTED, createGroup);
    yield takeEvery(SET_GROUP_PERMISSION.REQUESTED, setGroupPermission);
    yield throttle(100, REMOVE_GROUP.REQUESTED, removeGroup);
}

function* listGroups(action) {
    yield apiCall(groupsAPI.list, action, LIST_GROUPS);
}

function* createGroup(action) {
    yield setPending(apiCall(groupsAPI.create, action, CREATE_GROUP));
}

function* setGroupPermission(action) {
    yield setPending(apiCall(groupsAPI.setPermission, action, SET_GROUP_PERMISSION));
}

function* removeGroup(action) {
    yield setPending(apiCall(groupsAPI.remove, action, REMOVE_GROUP));
}
