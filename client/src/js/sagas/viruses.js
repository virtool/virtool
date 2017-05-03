/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";

import { virusesAPI } from "../api/viruses";
import {
    FIND_VIRUSES_REQUESTED,
    FIND_VIRUSES_SUCCEEDED,
    FIND_VIRUSES_FAILED
} from "../actions/actionTypes"

export function* watchViruses () {
    yield takeLatest(FIND_VIRUSES_REQUESTED, findViruses);
}

export function* findViruses () {
    try {
        const data = yield call(virusesAPI.find);
        yield put({type: FIND_VIRUSES_SUCCEEDED, data});
    } catch (error) {
        yield put({type: FIND_VIRUSES_FAILED}, error);
    }
}

/*

export function* getVirusSaga(virusId) {
}

export function* editVirusSaga (virusId, data) {
}

export function* removeVirusSaga (virusId) {
}

export function* listIsolatesSaga (virusId, isolateId) {
}

export function* addIsolateSaga (virusId, data) {
}
*/
