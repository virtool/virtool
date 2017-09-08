/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";
import groupsAPI from "./api";
import { LIST_GROUPS } from "../../actionTypes";

export function* watchGroups () {
    yield takeLatest(LIST_GROUPS.REQUESTED, listGroups);
}

function* listGroups () {
    try {
        const response = yield call(groupsAPI.list);
        yield put({type: LIST_GROUPS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: LIST_GROUPS.FAILED}, error);
    }
}
