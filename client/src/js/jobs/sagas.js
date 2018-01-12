import { getLocation, LOCATION_CHANGE } from "react-router-redux";
import { select, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as jobsAPI from "./api";
import { apiCall, apiFind, setPending } from "../sagaUtils";
import { WS_UPDATE_JOB, FIND_JOBS, GET_JOB, CANCEL_JOB, REMOVE_JOB, CLEAR_JOBS, GET_RESOURCES } from "../actionTypes";

export function* watchJobs () {
    yield takeLatest(WS_UPDATE_JOB, wsUpdateJob);
    yield throttle(300, LOCATION_CHANGE, findJobs);
    yield takeLatest(GET_JOB.REQUESTED, getJobWithPending);
    yield takeEvery(CANCEL_JOB.REQUESTED, cancelJob);
    yield takeEvery(REMOVE_JOB.REQUESTED, removeJob);
    yield takeLatest(CLEAR_JOBS.REQUESTED, clearJobs);
    yield takeLatest(GET_RESOURCES.REQUESTED, getResources);
}

export function* wsUpdateJob (action) {
    yield findJobs({payload: yield select(getLocation)});

    const detail = yield select(state => state.jobs.detail);

    if (detail !== null && detail.id === action.data.id) {
        yield getJob({id: detail.id});
    }
}

export function* findJobs (action) {
    yield apiFind("/jobs", jobsAPI.find, action, FIND_JOBS);
}

export function* getJobWithPending (action) {
    yield setPending(getJob(action));
}

export function* getJob (action) {
    yield apiCall(jobsAPI.get, action, GET_JOB);
}

export function* cancelJob (action) {
    yield setPending(apiCall(jobsAPI.cancel, action, CANCEL_JOB));
}

export function* removeJob (action) {
    yield setPending(apiCall(jobsAPI.remove, action, REMOVE_JOB));
    yield apiCall(jobsAPI.find, {}, FIND_JOBS);
}

export function* clearJobs (action) {
    yield setPending(apiCall(jobsAPI.clear, action, REMOVE_JOB));
    yield apiCall(jobsAPI.find, {}, FIND_JOBS);
}

export function* getResources () {
    yield apiCall(jobsAPI.getResources, {}, GET_RESOURCES);
}
