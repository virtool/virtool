import { apiCall, setPending } from "../sagaUtils";
import {
  LIST_JOBS,
  FILTER_JOBS,
  GET_JOB,
  CANCEL_JOB,
  REMOVE_JOB,
  CLEAR_JOBS,
  GET_RESOURCES
} from "../actionTypes";
import * as jobsAPI from "./api";
import { takeEvery, takeLatest } from "redux-saga/effects";

export function* watchJobs() {
  yield takeLatest(LIST_JOBS.REQUESTED, listJobs);
  yield takeLatest(FILTER_JOBS.REQUESTED, filterJobs);
  yield takeLatest(GET_JOB.REQUESTED, getJob);
  yield takeEvery(CANCEL_JOB.REQUESTED, cancelJob);
  yield takeEvery(REMOVE_JOB.REQUESTED, removeJob);
  yield takeLatest(CLEAR_JOBS.REQUESTED, clearJobs);
  yield takeLatest(GET_RESOURCES.REQUESTED, getResources);
}

export function* listJobs(action) {
  yield apiCall(jobsAPI.list, action, LIST_JOBS);
}

export function* filterJobs(action) {
  yield apiCall(jobsAPI.filter, action, FILTER_JOBS);
}

export function* getJob(action) {
  yield setPending(apiCall(jobsAPI.get, action, GET_JOB));
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
