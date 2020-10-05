import { takeLatest } from "redux-saga/effects";
import { GET_TASK, LIST_TASKS } from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as tasksAPI from "./api";

export function* listTasks(action) {
    yield apiCall(tasksAPI.list, action, LIST_TASKS);
}

export function* getTask(action) {
    yield apiCall(tasksAPI.get, action, GET_TASK);
}

export function* watchTasks() {
    yield takeLatest(GET_TASK.REQUESTED, getTask);
    yield takeLatest(LIST_TASKS.REQUESTED, listTasks);
}
