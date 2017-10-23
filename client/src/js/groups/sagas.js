/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import groupsAPI from "./api";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

export function* watchGroups () {
    yield takeLatest(LIST_GROUPS.REQUESTED, listGroups);
    yield throttle(200, CREATE_GROUP.REQUESTED, createGroup);
    yield takeEvery(SET_GROUP_PERMISSION.REQUESTED, setGroupPermission);
    yield throttle(100, REMOVE_GROUP.REQUESTED, removeGroup);
}

function* listGroups () {
    try {
        const response = yield groupsAPI.list();
        yield put({type: LIST_GROUPS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: LIST_GROUPS.FAILED}, error);
    }
}

function* createGroup (action) {
    try {
        const response = yield groupsAPI.create(action.groupId);
        yield put({type: CREATE_GROUP.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: CREATE_GROUP.FAILED}, error);
    }
}

function* setGroupPermission (action) {
    try {
        const response = yield groupsAPI.setPermission(action.groupId, action.permission, action.value);
        yield put({type: SET_GROUP_PERMISSION.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: SET_GROUP_PERMISSION.FAILED}, error);
    }
}

function* removeGroup (action) {
    try {
        yield groupsAPI.remove(action.groupId);
        yield put({type: REMOVE_GROUP.SUCCEEDED, id: action.groupId});
    } catch (error) {
        yield put({type: REMOVE_GROUP.FAILED}, error);
    }
}
