import { call, put, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import { UPDATE_LABEL, LIST_LABELS, CREATE_LABEL, REMOVE_LABEL } from "../app/actionTypes";
import { apiCall, setPending } from "../utils/sagas";
import * as labelsAPI from "./api";

export function* watchLabels() {
    yield takeLatest(LIST_LABELS.REQUESTED, listLabels);
    yield throttle(500, CREATE_LABEL.REQUESTED, createLabel);
    yield throttle(300, REMOVE_LABEL.REQUESTED, removeLabel);
    yield takeEvery(UPDATE_LABEL.REQUESTED, updateLabel);
}

export function* listLabels(action) {
    const response = yield labelsAPI.listLabels(action);
    yield put({ type: LIST_LABELS.SUCCEEDED, data: response.body });
}

export function* createLabel(action) {
    yield setPending(apiCall(labelsAPI.create, action, CREATE_LABEL));
    yield call(listLabels, { type: LIST_LABELS.REQUESTED });
}

export function* removeLabel(action) {
    yield setPending(apiCall(labelsAPI.remove, action, REMOVE_LABEL));
    yield call(listLabels, { type: LIST_LABELS.REQUESTED });
}

export function* updateLabel(action) {
    yield setPending(apiCall(labelsAPI.update, action, UPDATE_LABEL));
    yield call(listLabels, { type: LIST_LABELS.REQUESTED });
}
