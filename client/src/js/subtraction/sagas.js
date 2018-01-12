import { LOCATION_CHANGE, push } from "react-router-redux";
import { put, takeLatest, throttle } from "redux-saga/effects";

import * as subtractionAPI from "./api";
import { apiCall, apiFind, pushHistoryState, setPending } from "../sagaUtils";
import {
    FIND_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export function* findSubtractions (action) {
    yield setPending(apiFind("/subtraction", subtractionAPI.find, action, FIND_SUBTRACTIONS));
}

export function* listSubtractionIds (action) {
    yield setPending(apiCall(subtractionAPI.listIds, action, LIST_SUBTRACTION_IDS));
}

export function* getSubtraction (action) {
    yield setPending(apiCall(subtractionAPI.get, action, GET_SUBTRACTION));
}

export function* createSubtraction (action) {
    yield setPending(apiCall(subtractionAPI.create, action, CREATE_SUBTRACTION));
    yield put({type: FIND_SUBTRACTIONS.REQUESTED});
    yield pushHistoryState({createSubtraction: false});
}

export function* removeSubtraction (action) {
    yield setPending(function* () {
        yield apiCall(subtractionAPI.remove, action, REMOVE_SUBTRACTION);
        yield put(push("/subtraction"));
    });
}

export function* watchSubtraction () {
    yield throttle(300, LOCATION_CHANGE, findSubtractions);
    yield takeLatest(LIST_SUBTRACTION_IDS.REQUESTED, listSubtractionIds);
    yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
    yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
    yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}
