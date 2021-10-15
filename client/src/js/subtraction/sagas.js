import { push } from "connected-react-router";
import { put, takeLatest, throttle } from "redux-saga/effects";
import { pushState } from "../app/actions";
import {
    CREATE_SUBTRACTION,
    EDIT_SUBTRACTION,
    FIND_SUBTRACTIONS,
    GET_SUBTRACTION,
    REMOVE_SUBTRACTION,
    SHORTLIST_SUBTRACTIONS
} from "../app/actionTypes";
import { apiCall, pushFindTerm } from "../utils/sagas";
import * as subtractionAPI from "./api";

export function* findSubtractions(action) {
    yield apiCall(subtractionAPI.find, action, FIND_SUBTRACTIONS);
    yield pushFindTerm(action.term);
}

export function* getSubtraction(action) {
    yield apiCall(subtractionAPI.get, action, GET_SUBTRACTION);
}

export function* createSubtraction(action) {
    const resp = yield apiCall(subtractionAPI.create, action, CREATE_SUBTRACTION);

    if (resp.ok) {
        yield put(push("/subtraction"));
    }
}

export function* shortlistSubtractions(action) {
    yield apiCall(subtractionAPI.shortlist, action, SHORTLIST_SUBTRACTIONS);
}

export function* editSubtraction(action) {
    const resp = yield apiCall(subtractionAPI.edit, action, EDIT_SUBTRACTION);

    if (resp.ok) {
        yield put(pushState({ editSubtraction: false }));
    }
}

export function* removeSubtraction(action) {
    const resp = yield apiCall(subtractionAPI.remove, action, REMOVE_SUBTRACTION);

    if (resp.ok) {
        yield put(push("/subtraction"));
    }
}

export function* watchSubtraction() {
    yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
    yield takeLatest(FIND_SUBTRACTIONS.REQUESTED, findSubtractions);
    yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
    yield takeLatest(SHORTLIST_SUBTRACTIONS.REQUESTED, shortlistSubtractions);
    yield takeLatest(EDIT_SUBTRACTION.REQUESTED, editSubtraction);
    yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}
