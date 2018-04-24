import { LOCATION_CHANGE } from "react-router-redux";
import { takeLatest, throttle } from "redux-saga/effects";

import * as refsAPI from "./api";
import { apiCall, apiFind } from "../sagaUtils";
import { LIST_REFS, GET_REF } from "../actionTypes";

export function* listRefs (action) {
    yield apiFind("/viruses", refsAPI.list, action, LIST_REFS);
}

export function* getRef (action) {
    yield apiCall(refsAPI.get, action, GET_REF);
}

export function* watchViruses () {
    yield throttle(300, LOCATION_CHANGE, listRefs);
    yield takeLatest(GET_REF.REQUESTED, getRef);
}
