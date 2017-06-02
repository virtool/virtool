/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { pick } from "lodash";
import { call, put, select, takeEvery, takeLatest } from "redux-saga/effects";

import virusesAPI from "./api";
import { FIND_VIRUSES, GET_VIRUS, CREATE_VIRUS }  from "../actionTypes";

const getFindParams = state => {
    return pick(state.viruses, ["find", "sort", "descending", "modified"]);
};

export function* watchViruses () {
    yield takeLatest(FIND_VIRUSES.REQUESTED, findViruses);
    yield takeLatest(GET_VIRUS.REQUESTED, getVirus);
    yield takeEvery(CREATE_VIRUS.REQUESTED, createVirus);
}

export function* findViruses () {
    try {
        const findParams = yield select(getFindParams);
        const response = yield call(virusesAPI.find, findParams);

        yield put({type: FIND_VIRUSES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_VIRUSES.FAILED}, error);
    }
}

export function* getVirus (action) {
    try {
        const response = yield call(virusesAPI.get, action.virusId);
        yield put({type: GET_VIRUS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_VIRUS.FAILED, error: error});
    }
}

export function* createVirus (action) {
    try {
        const response = yield call(virusesAPI.create, action.name, action.abbreviation);
        yield put({type: CREATE_VIRUS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: CREATE_VIRUS.FAILED, error: error});
    }
}

