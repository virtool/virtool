/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, select, takeEvery, takeLatest } from "redux-saga/effects";

import jobsAPI from "./api";
import { setPending } from "../wrappers";
import {
    WS_UPDATE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    GET_RESOURCES,
} from "../actionTypes";

export function* watchJobs () {
    yield takeLatest(WS_UPDATE_JOB, wsUpdateJob);
    yield takeLatest(FIND_JOBS.REQUESTED, findJobsWithPending);
    yield takeLatest(GET_JOB.REQUESTED, getJobWithPending);
    yield takeEvery(CANCEL_JOB.REQUESTED, cancelJob);
    yield takeEvery(REMOVE_JOB.REQUESTED, removeJob);
    yield takeLatest(CLEAR_JOBS.REQUESTED, clearJobs);
    yield takeLatest(GET_RESOURCES.REQUESTED, getResources);
}

export function* wsUpdateJob (action) {
    yield findJobs(action);
    const detail = yield select(state => state.jobs.detail);

    if (detail !== null && detail.id === action.data.id) {
        yield getJob({id: detail.id});
    }
}

export function* findJobs () {
    try {
        const response = yield call(jobsAPI.find);
        yield put({type: FIND_JOBS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_JOBS.FAILED}, error);
    }
}

export function* findJobsWithPending (action) {
    yield setPending(findJobs, action);
}

export function* getJob (action) {
    try {
        const response = yield call(jobsAPI.get, action.jobId);
        yield put({type: GET_JOB.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_JOB.FAILED}, error);
    }
}

export function* getJobWithPending (action) {
    yield setPending(getJob, action);
}

export function* cancelJob (action) {
    yield setPending(function* () {
        try {
            const response = yield call(jobsAPI.cancel, action.jobId);
            yield put({type: CANCEL_JOB.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: CANCEL_JOB.FAILED}, error);
        }
    }, action);
}

export function* removeJob (action) {
    yield setPending(function* () {
        try {
            yield call(jobsAPI.remove, action.jobId);
            yield put({type: REMOVE_JOB.SUCCEEDED, jobId: action.jobId});
        } catch (error) {
            yield put({type: REMOVE_JOB.FAILED}, error);
        }
    }, action);
}

export function* clearJobs (action) {
    yield setPending(function* (action) {
        try {
            yield call(jobsAPI.clear, action.scope);
            yield put({type: REMOVE_JOB.SUCCEEDED});
            yield put({type: FIND_JOBS.REQUESTED});
        } catch (error) {
            yield put({type: REMOVE_JOB.FAILED}, error);
        }
    }, action);
}

export function* getResources (action) {
    try {
        const response = yield call(jobsAPI.getResources, action);
        yield put({type: GET_RESOURCES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_RESOURCES.FAILED}, error);
    }
}
