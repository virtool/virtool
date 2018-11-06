import { push } from "connected-react-router";
import { apiCall, pushFindTerm } from "../utils/sagas";
import { INSTALL_HMMS, GET_HMM, PURGE_HMMS, FIND_HMMS } from "../app/actionTypes";
import * as hmmsAPI from "./api";
import { takeLatest, throttle, put } from "redux-saga/effects";

export function* watchHmms() {
    yield throttle(300, FIND_HMMS.REQUESTED, findHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
    yield takeLatest(PURGE_HMMS.REQUESTED, purgeHmms);
}

export function* findHmms(action) {
    yield apiCall(hmmsAPI.find, action, FIND_HMMS);
    yield pushFindTerm(action.term);
}

export function* installHmms(action) {
    yield apiCall(hmmsAPI.install, action, INSTALL_HMMS);
}

export function* getHmm(action) {
    yield apiCall(hmmsAPI.get, action, GET_HMM);
}

export function* purgeHmms(action) {
    const extraFunc = {
        goToList: put(push("/hmm"))
    };
    yield apiCall(hmmsAPI.purge, action, PURGE_HMMS, {}, extraFunc);
}
