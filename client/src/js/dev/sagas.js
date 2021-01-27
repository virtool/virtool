import { put, takeLatest } from "redux-saga/effects";
import { pushState } from "../app/actions";
import { POST_DEV_COMMAND } from "../app/actionTypes";
import { apiCall } from "../utils/sagas";
import * as devApi from "./api";

export function* watchDev() {
    yield takeLatest(POST_DEV_COMMAND.REQUESTED, postDevCommand);
}

export function* postDevCommand(action) {
    yield apiCall(devApi.post, action, POST_DEV_COMMAND);

    if (action.command === "clear_users") {
        yield put(pushState({}));
        location.reload();
    }
}
