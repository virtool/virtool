import { takeLatest } from "redux-saga/effects";
import { GET_CACHE } from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as cachesAPI from "./api";

export function* watchCaches() {
    yield takeLatest(GET_CACHE.REQUESTED, getCache);
}

export function* getCache(action) {
    yield apiCall(cachesAPI.get, action, GET_CACHE);
}
