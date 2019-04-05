import { get } from "lodash-es";
import { apiCall, pushFindTerm, setPending } from "../utils/sagas";
import {
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    GET_RESOURCES,
    WS_UPDATE_JOB,
    GET_LINKED_JOB
} from "../app/actionTypes";
import * as jobsAPI from "./api";
import { select, takeEvery, takeLatest } from "redux-saga/effects";

const getJobDetailId = state => get(state, "jobs.detail.id");

export function* watchJobs() {
    yield takeLatest(FIND_JOBS.REQUESTED, findJobs);
    yield takeLatest(GET_JOB.REQUESTED, getJob);
    yield takeEvery(CANCEL_JOB.REQUESTED, cancelJob);
    yield takeEvery(REMOVE_JOB.REQUESTED, removeJob);
    yield takeLatest(CLEAR_JOBS.REQUESTED, clearJobs);
    yield takeLatest(GET_RESOURCES.REQUESTED, getResources);
    yield takeLatest(WS_UPDATE_JOB, wsUpdateJob);
    yield takeEvery(GET_LINKED_JOB.REQUESTED, getLinkedJob);
}

export function* wsUpdateJob(action) {
    const jobDetailId = yield select(getJobDetailId);
    if (action.data.id === jobDetailId) {
        yield apiCall(jobsAPI.get, { jobId: jobDetailId }, GET_JOB);
    }
}

export function* findJobs(action) {
    yield apiCall(jobsAPI.find, action, FIND_JOBS);
    yield pushFindTerm(action.term);
}

export function* getJob(action) {
    yield setPending(apiCall(jobsAPI.get, action, GET_JOB));
}

export function* getLinkedJob(action) {
    yield setPending(apiCall(jobsAPI.get, action, GET_LINKED_JOB));
}

export function* cancelJob(action) {
    yield setPending(apiCall(jobsAPI.cancel, action, CANCEL_JOB));
}

export function* removeJob(action) {
    yield setPending(apiCall(jobsAPI.remove, action, REMOVE_JOB));
}

export function* clearJobs(action) {
    yield setPending(apiCall(jobsAPI.clear, action, REMOVE_JOB));
}

export function* getResources() {
    yield apiCall(jobsAPI.getResources, {}, GET_RESOURCES);
}
