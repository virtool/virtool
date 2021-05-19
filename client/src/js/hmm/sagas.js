import { getLocation, push } from "connected-react-router";
import { put, select, takeLatest, throttle } from "redux-saga/effects";
import { FIND_HMMS, GET_HMM, INSTALL_HMMS, PURGE_HMMS } from "../app/actionTypes";
import { apiCall, pushFindTerm } from "../utils/sagas";
import * as hmmsAPI from "./api";

export function* watchHmms() {
    yield throttle(300, FIND_HMMS.REQUESTED, findHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
    yield takeLatest(PURGE_HMMS.REQUESTED, purgeHmms);
}

export function* findHmms(action) {
    yield apiCall(hmmsAPI.find, action, FIND_HMMS);

    const routerLocation = yield select(getLocation);

    if (routerLocation.pathname.startsWith("/hmm")) {
        yield pushFindTerm(action.term);
    }
}

export function* installHmms(action) {
    yield apiCall(hmmsAPI.install, action, INSTALL_HMMS);
}

export function* getHmm(action) {
    yield apiCall(hmmsAPI.get, action, GET_HMM);
}

export function* purgeHmms(action) {
    const resp = yield apiCall(hmmsAPI.purge, action, PURGE_HMMS, {}, extraFunc);

    if (resp.ok) {
        yield put(push("/hmm"));
    }
}
