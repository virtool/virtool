/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";

import jobsAPI from "./api";
import { FIND_JOBS, GET_JOB }  from "../actionTypes";

export function* watchJobs () {
    yield takeLatest(FIND_JOBS.REQUESTED, findJobs);
    yield takeLatest(GET_JOB.REQUESTED, getJob);
}

export function* findJobs () {
    try {
        const response = yield call(jobsAPI.find);
        yield put({type: FIND_JOBS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_JOBS.FAILED}, error);
    }
}

export function* getJob (action) {
    try {
        const response = yield call(jobsAPI.get, action.jobId);
        yield put({type: GET_JOB.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_JOB.FAILED}, error);
    }
}
