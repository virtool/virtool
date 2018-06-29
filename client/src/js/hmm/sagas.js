import { LOCATION_CHANGE } from "react-router-redux";
import { takeLatest, throttle, put } from "redux-saga/effects";

import * as hmmsAPI from "./api";
import { apiCall, apiFind } from "../sagaUtils";
import {FIND_HMMS, INSTALL_HMMS, GET_HMM, FETCH_HMMS, PURGE_HMMS} from "../actionTypes";

export function* watchHmms () {
    yield throttle(300, LOCATION_CHANGE, findHmms);
    yield takeLatest(FIND_HMMS.REQUESTED, listHmms);
    yield takeLatest(FETCH_HMMS, fetchHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
    yield takeLatest(PURGE_HMMS.REQUESTED, purgeHmms);
}

export function* fetchHmms () {
    yield apiCall(hmmsAPI.find, {}, FIND_HMMS);
}

export function* findHmms (action) {
    yield apiFind("/hmm", hmmsAPI.find, action, FIND_HMMS);
}

export function* listHmms (action) {
    yield apiCall(hmmsAPI.nextPage, action, FIND_HMMS);
}

export function* installHmms (action) {
    yield apiCall(hmmsAPI.install, action, INSTALL_HMMS);
    yield put({
        type: FIND_HMMS.REQUESTED,
        page: 1
    });
}

export function* getHmm (action) {
    yield apiCall(hmmsAPI.get, action, GET_HMM);
}

export function* purgeHmms (action) {
    yield apiCall(hmmsAPI.purge, action, PURGE_HMMS);
}
