/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeEvery, takeLatest } from "redux-saga/effects";

import indexesAPI from "./api";
import { setPending } from "../wrappers";
import { FIND_INDEXES, GET_INDEX, CREATE_INDEX }  from "../actionTypes";

export function* watchIndexes () {
    yield takeLatest(FIND_INDEXES.REQUESTED, findIndexes);
    yield takeLatest(GET_INDEX.REQUESTED, getIndex);
    yield takeEvery(CREATE_INDEX.REQUESTED, createIndex);
}

export function* findIndexes (action) {
    yield setPending(function* () {
        try {
            const response = yield call(indexesAPI.find);
            yield put({type: FIND_INDEXES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_INDEXES.FAILED}, error);
        }
    }, action);
}

export function* getIndex (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(indexesAPI.get, action.indexVersion);
            yield put({type: GET_INDEX.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: GET_INDEX.FAILED}, error);
        }
    }, action);
}

export function* createIndex (action) {
    yield setPending(function* () {
        try {
            const response = yield call(indexesAPI.create);
            yield put({type: CREATE_INDEX.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: CREATE_INDEX.FAILED, error: error});
        }
    }, action);
}
