import { put, takeLatest } from "redux-saga/effects";
import * as updatesAPI from "./api";
import { apiCall } from "../sagaUtils";
import {
    GET_SOFTWARE_UPDATES,
    GET_DATABASE_UPDATES,
    INSTALL_SOFTWARE_UPDATES,
    UPDATE_SETTINGS
} from "../actionTypes";

function* getSoftwareUpdates (action) {
    yield apiCall(updatesAPI.getSoftware, action, GET_SOFTWARE_UPDATES);
}

function* setSoftwareChannel (action) {
    if (action.update.software_channel) {
        yield put({type: GET_SOFTWARE_UPDATES.REQUESTED});
    }
}

function* getDatabaseUpdates (action) {
    yield apiCall(updatesAPI.getDatabase, action, GET_DATABASE_UPDATES);
}

function* installSoftwareUpdates (action) {
    yield apiCall(updatesAPI.installSoftwareUpdates, action, INSTALL_SOFTWARE_UPDATES);
}

export function* watchUpdates () {
    yield takeLatest(GET_SOFTWARE_UPDATES.REQUESTED, getSoftwareUpdates);
    yield takeLatest(UPDATE_SETTINGS.SUCCEEDED, setSoftwareChannel);
    yield takeLatest(GET_DATABASE_UPDATES.REQUESTED, getDatabaseUpdates);
    yield takeLatest(INSTALL_SOFTWARE_UPDATES.REQUESTED, installSoftwareUpdates);
}
