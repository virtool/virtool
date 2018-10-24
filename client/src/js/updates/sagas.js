import { apiCall } from "../sagaUtils";
import {
  GET_SOFTWARE_UPDATES,
  INSTALL_SOFTWARE_UPDATES,
  UPDATE_SETTINGS
} from "../actionTypes";
import * as updatesAPI from "./api";
import { put, takeLatest } from "redux-saga/effects";

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
