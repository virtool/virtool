import { LOCATION_CHANGE, push } from "react-router-redux";
import { put, takeLatest, throttle } from "redux-saga/effects";

import * as subtractionAPI from "./api";
import { apiCall, apiFind, pushHistoryState, putGenericError, setPending } from "../sagaUtils";
import {
    FIND_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    UPDATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export function* findSubtractions (action) {
    yield apiFind("/subtraction", subtractionAPI.find, action, FIND_SUBTRACTIONS);
}

export function* listSubtractionIds (action) {
    yield apiCall(subtractionAPI.listIds, action, LIST_SUBTRACTION_IDS);
}

export function* getSubtraction (action) {
    yield apiCall(subtractionAPI.get, action, GET_SUBTRACTION);
}

export function* createSubtraction (action) {
    yield setPending(apiCustomCall(subtractionAPI.create, action, CREATE_SUBTRACTION));

    function* apiCustomCall (apiMethod, action, actionType, extra = {}) {
        try {
            const response = yield apiMethod(action);
            yield put({type: actionType.SUCCEEDED, data: response.body, ...extra});
            yield put({type: FIND_SUBTRACTIONS.REQUESTED});
            yield pushHistoryState({createSubtraction: false});
        } catch (error) {
            yield putGenericError(actionType, error);
        }
    }
}

export function* updateSubtraction (action) {
    yield setPending(apiCall(subtractionAPI.update, action, UPDATE_SUBTRACTION));
}

export function* removeSubtraction (action) {
    yield apiCall(subtractionAPI.remove, action, REMOVE_SUBTRACTION);
    yield put(push("/subtraction"));
}

export function* watchSubtraction () {
    yield throttle(300, LOCATION_CHANGE, findSubtractions);
    yield takeLatest(LIST_SUBTRACTION_IDS.REQUESTED, listSubtractionIds);
    yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
    yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
    yield takeLatest(UPDATE_SUBTRACTION.REQUESTED, updateSubtraction);
    yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}
