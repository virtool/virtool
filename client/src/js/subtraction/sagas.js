import { push } from "react-router-redux";

import { apiCall, pushFindTerm, pushHistoryState, setPending } from "../utils/sagas";
import {
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    UPDATE_SUBTRACTION,
    REMOVE_SUBTRACTION,
    FIND_SUBTRACTIONS
} from "../app/actionTypes";
import * as subtractionAPI from "./api";
import { put, takeLatest, throttle, call } from "redux-saga/effects";

export function* findSubtractions(action) {
    yield apiCall(subtractionAPI.find, action, FIND_SUBTRACTIONS);
    yield pushFindTerm(action.term);
}

export function* getSubtraction(action) {
    yield apiCall(subtractionAPI.get, action, GET_SUBTRACTION);
}

export function* createSubtraction(action) {
    const extraFunc = {
        closeModal: call(pushHistoryState, { createSubtraction: false })
    };
    yield setPending(apiCall(subtractionAPI.create, action, CREATE_SUBTRACTION, {}, extraFunc));
}

export function* updateSubtraction(action) {
    yield setPending(apiCall(subtractionAPI.update, action, UPDATE_SUBTRACTION));
}

export function* removeSubtraction(action) {
    const extraFunc = {
        goBack: put(push("/subtraction"))
    };
    yield apiCall(subtractionAPI.remove, action, REMOVE_SUBTRACTION, {}, extraFunc);
}

export function* watchSubtraction() {
    yield takeLatest(FIND_SUBTRACTIONS.REQUESTED, findSubtractions);
    yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
    yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
    yield takeLatest(UPDATE_SUBTRACTION.REQUESTED, updateSubtraction);
    yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}
