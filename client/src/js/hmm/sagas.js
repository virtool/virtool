/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import URI from "urijs";
import { put, takeLatest, throttle } from "redux-saga/effects";

import hmmsAPI from "./api";
import { setPending } from "../wrappers";
import { FIND_HMMS, INSTALL_HMMS, GET_HMM } from "../actionTypes";

export function* watchHmms () {
    yield throttle(150, FIND_HMMS.REQUESTED, findHmms);
    yield takeLatest(GET_HMM.REQUESTED, getHmm);
    yield throttle(500, INSTALL_HMMS.REQUESTED, installHmms);
}

export function* findHmms (action) {
    yield setPending(function* (action) {
        const uri = URI(action.url);

        try {
            const response = yield hmmsAPI.find(uri.search(true));
            yield put({type: FIND_HMMS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_HMMS.FAILED});
        }
    }, action)
}

export function* installHmms () {
    try {
        const response = yield hmmsAPI.install();
        yield put({type: INSTALL_HMMS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: INSTALL_HMMS.FAILED});
    }
}


export function* getHmm (action) {
    yield setPending(function* () {
        try {
            const response = yield hmmsAPI.get(action.hmmId);
            yield put({type: GET_HMM.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: GET_HMM.FAILED});
        }
    }, action);
}
