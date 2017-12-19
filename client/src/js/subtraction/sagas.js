import { push } from "react-router-redux";
import { put, takeLatest, throttle } from "redux-saga/effects";
import subtractionAPI from "./api";
import { pushHistoryState, putGenericError, setPending } from "../sagaHelpers";
import {
    FIND_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export function* findSubtractions (action) {
    yield setPending(function* (action) {
        try {
            const response = yield subtractionAPI.find(action.term, action.page);
            yield put({type: FIND_SUBTRACTIONS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield putGenericError(FIND_SUBTRACTIONS, error);
        }
    }, action);
}

export function* listSubtractionIds () {
    try {
        const response = yield subtractionAPI.listIds();
        yield put({type: LIST_SUBTRACTION_IDS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield putGenericError(LIST_SUBTRACTION_IDS, error);
    }
}

export function* getSubtraction (action) {
    try {
        const response = yield subtractionAPI.get(action.subtractionId);
        yield put({type: GET_SUBTRACTION.SUCCEEDED, data: response.body});
    } catch (error) {
        yield putGenericError(GET_SUBTRACTION, error);
    }
}

export function* createSubtraction (action) {
    yield setPending(function* (action) {
        try {
            yield subtractionAPI.create(action.subtractionId, action.fileId);
            yield put({type: FIND_SUBTRACTIONS.REQUESTED});
            yield pushHistoryState({createSubtraction: false});
        } catch (error) {
            yield putGenericError(CREATE_SUBTRACTION, error);
        }
    }, action);
}

export function* removeSubtraction (action) {
    yield setPending(function* (action) {
        try {
            yield subtractionAPI.remove(action.subtractionId);
            yield put(push("/subtraction"));
        } catch (error) {
            yield putGenericError(REMOVE_SUBTRACTION, error);
        }
    }, action);
}

export function* watchSubtraction () {
    yield throttle(500, FIND_SUBTRACTIONS.REQUESTED, findSubtractions);
    yield takeLatest(LIST_SUBTRACTION_IDS.REQUESTED, listSubtractionIds);
    yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
    yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
    yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}
