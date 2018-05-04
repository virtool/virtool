import { LOCATION_CHANGE } from "react-router-redux";
import { takeLatest, throttle, put } from "redux-saga/effects";

import * as referenceAPI from "./api";
import { apiCall, apiFind } from "../sagaUtils";
import { CREATE_REFERENCE, GET_REFERENCE, LIST_REFERENCES } from "../actionTypes";

export function* listReferences (action) {
    yield apiFind("/refs", referenceAPI.list, action, LIST_REFERENCES);
}

export function* getReference (action) {
    yield apiCall(referenceAPI.get, action, GET_REFERENCE);
}

export function* createReference (action) {
    yield apiCall(referenceAPI.create, action, CREATE_REFERENCE);
    yield put({type: LIST_REFERENCES.REQUESTED});
}

export function* watchReferences () {
    yield throttle(300, CREATE_REFERENCE.REQUESTED, createReference);
    yield takeLatest(GET_REFERENCE.REQUESTED, getReference);
    yield throttle(300, LOCATION_CHANGE, listReferences);
}
