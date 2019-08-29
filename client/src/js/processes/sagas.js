import { takeLatest } from "redux-saga/effects";
import { GET_PROCESS, LIST_PROCESSES } from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as processesAPI from "./api";

export function* listProcesses(action) {
    yield apiCall(processesAPI.list, action, LIST_PROCESSES);
}

export function* getProcess(action) {
    yield apiCall(processesAPI.get, action, GET_PROCESS);
}

export function* watchProcesses() {
    yield takeLatest(GET_PROCESS.REQUESTED, getProcess);
    yield takeLatest(LIST_PROCESSES.REQUESTED, listProcesses);
}
