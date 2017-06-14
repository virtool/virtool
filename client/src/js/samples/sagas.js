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
import { setPending } from "../wrappers";
import { FIND_SAMPLES, GET_SAMPLE }  from "../actionTypes";

export function* watchSamples () {
    yield takeLatest(FIND_SAMPLES.REQUESTED, findSamples);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
}

export function* findSamples (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(samplesAPI.find, action.term);
            yield put({type: FIND_SAMPLES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_SAMPLES.FAILED}, error);
        }
    }, action);
}

export function* getSample (action) {
    try {
        const response = yield call(samplesAPI.get, action.sampleId);
        yield put({type: GET_SAMPLE.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SAMPLE.FAILED}, error);
    }
}
