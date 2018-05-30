import { LOCATION_CHANGE, push } from "react-router-redux";
import { takeLatest, throttle, put, takeEvery } from "redux-saga/effects";

import * as referenceAPI from "./api";
import { apiCall, apiFind, setPending } from "../sagaUtils";
import {
    CREATE_REFERENCE,
    GET_REFERENCE,
    LIST_REFERENCES,
    REMOVE_REFERENCE,
    EDIT_REFERENCE,
    IMPORT_REFERENCE,
    CLONE_REFERENCE,
    REMOTE_REFERENCE,
    ADD_REFERENCE_USER,
    EDIT_REFERENCE_USER,
    REMOVE_REFERENCE_USER,
    ADD_REFERENCE_GROUP,
    EDIT_REFERENCE_GROUP,
    REMOVE_REFERENCE_GROUP
} from "../actionTypes";

export function* listReferences (action) {
    yield apiFind("/refs", referenceAPI.list, action, LIST_REFERENCES);
}

export function* getReference (action) {
    yield apiCall(referenceAPI.get, action, GET_REFERENCE);
}

export function* createReference (action) {
    yield apiCall(referenceAPI.create, action, CREATE_REFERENCE);
    yield put(push({state: {createReference: false}}));
}

export function* editReference (action) {
    yield apiCall(referenceAPI.edit, action, EDIT_REFERENCE);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.referenceId
    });
}

export function* removeReference (action) {
    yield setPending(apiCall(referenceAPI.remove, action, REMOVE_REFERENCE));
    yield put(push("/refs"));
}

export function* importReference (action) {
    yield setPending(apiCall(referenceAPI.importReference, action, IMPORT_REFERENCE));
    yield put(push({state: {importReference: false}}));
}

export function* cloneReference (action) {
    yield setPending(apiCall(referenceAPI.cloneReference, action, CLONE_REFERENCE));
    yield put(push({state: {cloneReference: false}}));
}

export function* remoteReference () {
    yield setPending(apiCall(
        referenceAPI.remoteReference,
        { remote_from: "virtool/virtool-database" },
        REMOTE_REFERENCE
    ));
}

export function* addRefUser (action) {
    yield apiCall(referenceAPI.addUser, action, ADD_REFERENCE_USER);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.refId
    });
}

export function* editRefUser (action) {
    yield apiCall(referenceAPI.editUser, action, EDIT_REFERENCE_USER);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.refId
    });
}

export function* removeRefUser (action) {
    yield apiCall(referenceAPI.removeUser, action, REMOVE_REFERENCE_USER);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.refId
    });
}

export function* addRefGroup (action) {
    yield apiCall(referenceAPI.addGroup, action, ADD_REFERENCE_GROUP);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.refId
    });
}

export function* editRefGroup (action) {
    yield apiCall(referenceAPI.editGroup, action, EDIT_REFERENCE_GROUP);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.refId
    });
}

export function* removeRefGroup (action) {
    yield apiCall(referenceAPI.removeGroup, action, REMOVE_REFERENCE_GROUP);
    yield getReference({
        type: GET_REFERENCE.REQUESTED,
        referenceId: action.refId
    });
}

export function* watchReferences () {
    yield throttle(300, CREATE_REFERENCE.REQUESTED, createReference);
    yield takeEvery(EDIT_REFERENCE.REQUESTED, editReference);
    yield takeLatest(GET_REFERENCE.REQUESTED, getReference);
    yield throttle(300, LOCATION_CHANGE, listReferences);
    yield takeEvery(REMOVE_REFERENCE.REQUESTED, removeReference);
    yield takeLatest(IMPORT_REFERENCE.REQUESTED, importReference);
    yield takeLatest(CLONE_REFERENCE.REQUESTED, cloneReference);
    yield takeLatest(REMOTE_REFERENCE.REQUESTED, remoteReference);
    yield takeEvery(ADD_REFERENCE_USER.REQUESTED, addRefUser);
    yield takeEvery(EDIT_REFERENCE_USER.REQUESTED, editRefUser);
    yield takeEvery(REMOVE_REFERENCE_USER.REQUESTED, removeRefUser);
    yield takeEvery(ADD_REFERENCE_GROUP.REQUESTED, addRefGroup);
    yield takeEvery(EDIT_REFERENCE_GROUP.REQUESTED, editRefGroup);
    yield takeEvery(REMOVE_REFERENCE_GROUP.REQUESTED, removeRefGroup);
}
