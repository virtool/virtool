/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeLatest } from "redux-saga/effects";

import filesAPI from "./api";
import { setPending } from "../wrappers";
import { FIND_FILES }  from "../actionTypes";

export function* watchFiles () {
    yield takeLatest(FIND_FILES.REQUESTED, findFiles);
}

export function* findFiles (action) {
    yield setPending(function* () {
        try {
            const response = yield call(filesAPI.find);
            console.log(response);
            yield put({type: FIND_FILES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_FILES.FAILED}, error);
        }
    }, action);
}

