/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeEvery, takeLatest } from "redux-saga/effects";

import settingsAPI from "./api";
import { setPending } from "../wrappers";
import { GET_SETTINGS, UPDATE_SETTING } from "../actionTypes";

export function* watchSettings () {
    yield takeLatest(GET_SETTINGS.REQUESTED, getSettings);
    yield takeEvery(UPDATE_SETTING.REQUESTED, updateSetting)
}

function* getSettings () {
    try {
        const response = yield call(settingsAPI.get);
        yield put({type: GET_SETTINGS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SETTINGS.FAILED}, error);
    }
}

function* updateSetting (action) {
    yield setPending(function* () {
        try {
            const response = yield call(settingsAPI.update, action.update);
            yield put({
                type: UPDATE_SETTING.SUCCEEDED,
                settings: response.body,
                key: action.key,
                update: action.update
            });
        } catch(error) {
            yield put({type: UPDATE_SETTING.FAILED, key: action.key});
        }
    }, action);
}
