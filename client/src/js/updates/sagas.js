import { put, takeLatest } from "redux-saga/effects";
import { GET_SOFTWARE_UPDATES, INSTALL_SOFTWARE_UPDATES, UPDATE_SETTINGS } from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as updatesAPI from "./api";

function* getSoftwareUpdates(action) {
    yield apiCall(updatesAPI.get, action, GET_SOFTWARE_UPDATES);
}

function* setSoftwareChannel(action) {
    if (action.update.software_channel) {
        yield put({ type: GET_SOFTWARE_UPDATES.REQUESTED });
    }
}

function* installSoftwareUpdates(action) {
    yield apiCall(updatesAPI.install, action, INSTALL_SOFTWARE_UPDATES);
}

export function* watchUpdates() {
    yield takeLatest(GET_SOFTWARE_UPDATES.REQUESTED, getSoftwareUpdates);
    yield takeLatest(UPDATE_SETTINGS.SUCCEEDED, setSoftwareChannel);
    yield takeLatest(INSTALL_SOFTWARE_UPDATES.REQUESTED, installSoftwareUpdates);
}
