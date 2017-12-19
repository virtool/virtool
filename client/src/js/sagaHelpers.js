import { put } from "redux-saga/effects";
import { push } from "react-router-redux";
import {SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";

export function* pushHistoryState (update) {
    yield put(push({...window.location, state: update}));
}

export function* putGenericError (actionType, error) {
    yield put({
        type: actionType.FAILED,
        status: error.response.status,
        ...error.response.body.message
    });
}

export function* setPending (generator, action) {
    yield put({type: SET_APP_PENDING});
    yield generator(action);
    yield put({type: UNSET_APP_PENDING});
}
