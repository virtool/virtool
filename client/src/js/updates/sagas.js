/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";
import updatesAPI from "./api";
import { GET_SOFTWARE_UPDATES, GET_DATABASE_UPDATES } from "../actionTypes";

export function* watchUpdates () {
    yield takeLatest(GET_SOFTWARE_UPDATES.REQUESTED, getSoftwareUpdates);
    yield takeLatest(GET_DATABASE_UPDATES.REQUESTED, getDatabaseUpdates);
}

function* getSoftwareUpdates () {
    try {
        const response = yield call(updatesAPI.getSoftware);
        yield put({type: GET_SOFTWARE_UPDATES.SUCCEEDED, data: response.body});
    } catch(error) {
        yield put({type: GET_SOFTWARE_UPDATES.FAILED})
    }
}

function* getDatabaseUpdates () {
    try {
        const response = yield call(updatesAPI.getDatabase);
        yield put({type: GET_DATABASE_UPDATES.SUCCEEDED, data: response.body});
    } catch(error) {
        yield put({type: GET_DATABASE_UPDATES.FAILED})
    }
}
