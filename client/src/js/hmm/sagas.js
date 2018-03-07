import { LOCATION_CHANGE } from "react-router-redux";
import { takeLatest, throttle } from "redux-saga/effects";

import * as hmmsAPI from "./api";
import { apiCall, apiFind } from "../sagaUtils";
import { FIND_HMMS, INSTALL_HMMS, GET_HMM, FETCH_HMMS } from "../actionTypes";

export function* watchHmms () {
    yield throttle(300, LOCATION_CHANGE, findHmms);
    yield takeLatest(FETCH_HMMS, fetchHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
}

export function* fetchHmms () {
    yield apiCall(hmmsAPI.find, {}, FIND_HMMS);
}

export function* findHmms (action) {
    yield apiFind("/hmm", hmmsAPI.find, action, FIND_HMMS);
}

export function* installHmms () {
    yield apiCall(hmmsAPI.install, {}, INSTALL_HMMS);
}

export function* getHmm (action) {
    yield apiCall(hmmsAPI.get, action, GET_HMM);
}
