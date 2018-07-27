import { takeLatest, throttle, put } from "redux-saga/effects";
import { push } from "react-router-redux";
import * as hmmsAPI from "./api";
import { apiCall } from "../sagaUtils";
import {
    LIST_HMMS,
    FILTER_HMMS,
    INSTALL_HMMS,
    GET_HMM,
    PURGE_HMMS
} from "../actionTypes";

export function* watchHmms () {
    yield takeLatest(LIST_HMMS.REQUESTED, listHmms);
    yield takeLatest(FILTER_HMMS.REQUESTED, filterHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
    yield takeLatest(PURGE_HMMS.REQUESTED, purgeHmms);
}

export function* listHmms (action) {
    yield apiCall(hmmsAPI.list, action, LIST_HMMS);
}

export function* filterHmms (action) {
    yield apiCall(hmmsAPI.filter, action, FILTER_HMMS);
}

export function* installHmms (action) {
    yield apiCall(hmmsAPI.install, action, INSTALL_HMMS);
}

export function* getHmm (action) {
    yield apiCall(hmmsAPI.get, action, GET_HMM);
}

export function* purgeHmms (action) {
    const extraFunc = {
        goToList: put(push("/hmm"))
    };
    yield apiCall(hmmsAPI.purge, action, PURGE_HMMS, {}, extraFunc);
}
