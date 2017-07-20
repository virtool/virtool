/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { put, call } from "redux-saga/effects";

import { SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";

export function* setPending (generator, action) {
    yield put({type: SET_APP_PENDING});
    yield call(generator, action);
    yield put({type: UNSET_APP_PENDING});
}
