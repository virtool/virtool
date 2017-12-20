import { takeLatest, throttle } from "redux-saga/effects";

import hmmsAPI from "./api";
import { apiCall, setPending } from "../sagaUtils";
import { FIND_HMMS, INSTALL_HMMS, GET_HMM } from "../actionTypes";

export function* watchHmms () {
    yield throttle(150, FIND_HMMS.REQUESTED, findHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
}

export function* findHmms (action) {
    yield setPending(apiCall(hmmsAPI.find, action, FIND_HMMS));
}

export function* installHmms () {
    yield apiCall(hmmsAPI.install, {}, INSTALL_HMMS);
}

export function* getHmm (action) {
    yield setPending(apiCall(hmmsAPI.get, action, GET_HMM));
}
