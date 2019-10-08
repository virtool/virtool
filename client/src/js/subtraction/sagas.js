import { push } from "connected-react-router";
import { call, put, takeLatest, throttle } from "redux-saga/effects";
import {
    CREATE_SUBTRACTION,
    FIND_SUBTRACTIONS,
    GET_SUBTRACTION,
    LIST_SUBTRACTION_IDS,
    REMOVE_SUBTRACTION,
    UPDATE_SUBTRACTION
} from "../app/actionTypes";
import { apiCall, pushFindTerm, pushHistoryState, setPending } from "../utils/sagas";
import * as subtractionAPI from "./api";

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

export function* listSubtractionIds(action) {
    yield apiCall(subtractionAPI.listIds, action, LIST_SUBTRACTION_IDS);
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
    yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
    yield takeLatest(FIND_SUBTRACTIONS.REQUESTED, findSubtractions);
    yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
    yield takeLatest(LIST_SUBTRACTION_IDS.REQUESTED, listSubtractionIds);
    yield takeLatest(UPDATE_SUBTRACTION.REQUESTED, updateSubtraction);
    yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}
