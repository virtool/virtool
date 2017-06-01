/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { pick } from "lodash";
import { call, put, select, takeLatest } from "redux-saga/effects";

import virusesAPI from "./api";
import { FIND_VIRUSES }  from "../actionTypes";

const getFindParams = state => {
    return pick(state.viruses, ["find", "sort", "descending", "modified"]);
};

export function* watchViruses () {
    yield takeLatest(FIND_VIRUSES.REQUESTED, findViruses);
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
