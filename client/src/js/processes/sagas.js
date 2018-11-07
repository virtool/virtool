import { apiCall } from "../utils/sagas";
import { LIST_PROCESSES, GET_PROCESS } from "../app/actionTypes";
import * as processesAPI from "./api";
import { takeLatest } from "redux-saga/effects";

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
