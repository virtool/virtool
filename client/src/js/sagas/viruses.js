/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { pick } from "lodash";
import { put, select, takeLatest } from "redux-saga/effects";

import { virusesAPI } from "../api/viruses";
import {
    FIND_VIRUSES_REQUESTED,
    FIND_VIRUSES_SUCCEEDED,
    FIND_VIRUSES_FAILED
} from "../actions/actionTypes"

const getFindParams = state => {
    return pick(state.viruses, ["find", "sort", "descending", "modified"]);
};

export function* watchViruses () {
    yield takeLatest(FIND_VIRUSES_REQUESTED, findViruses);
}

export function* findViruses () {
    try {
        const findParams = yield select(getFindParams);
        const response = yield virusesAPI.find(findParams);

        yield put({type: FIND_VIRUSES_SUCCEEDED, data: response.body});
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
