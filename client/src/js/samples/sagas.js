/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";

import samplesAPI from "./api";
import { FIND_SAMPLES }  from "../actionTypes";

export function* watchSamples () {
    yield takeLatest(FIND_SAMPLES.REQUESTED, findSamples);
}

export function* findSamples (action) {
    try {
        const response = yield call(samplesAPI.find, action.term);
        yield put({type: FIND_SAMPLES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_SAMPLES.FAILED}, error);
    }
}
