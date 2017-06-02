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
import { FIND_VIRUSES, CREATE_VIRUS }  from "../actionTypes";

const getFindParams = state => {
    return pick(state.viruses, ["find", "sort", "descending", "modified"]);
};

export function* watchViruses () {
    console.log(CREATE_VIRUS);

    yield takeLatest(FIND_VIRUSES.REQUESTED, findViruses);
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

export function* createVirus (action) {
    try {
        const response = yield call(virusesAPI.create, action.name, action.abbreviation);
        yield put({type: CREATE_VIRUS.SUCCEEDED, data: response.body});
    } catch (error) {
        console.log("ERROR", error);
        yield put({type: CREATE_VIRUS.FAILED, error: res.body});
    }
}

