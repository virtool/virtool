import { apiCall } from "../utils/sagas";
import { GET_CACHE } from "../app/actionTypes";
import * as cachesAPI from "./api";
import { takeLatest } from "redux-saga/effects";

export function* watchCaches() {
    yield takeLatest(GET_CACHE.REQUESTED, getCache);
}

export function* getCache(action) {
    yield apiCall(cachesAPI.get, action, GET_CACHE);
}
