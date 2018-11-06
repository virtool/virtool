import { push } from "react-router-redux";

import { apiCall, pushFindTerm, setPending } from "../utils/sagas";
import {
    CREATE_REFERENCE,
    GET_REFERENCE,
    FIND_REFERENCES,
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
    REMOVE_REFERENCE_GROUP,
    CHECK_REMOTE_UPDATES,
    UPDATE_REMOTE_REFERENCE
} from "../app/actionTypes";
import * as referenceAPI from "./api";
import { takeLatest, throttle, put, takeEvery } from "redux-saga/effects";

export function* findReferences(action) {
    yield apiCall(referenceAPI.find, action, FIND_REFERENCES);
    yield pushFindTerm(action.term);
}

export function* getReference(action) {
    yield apiCall(referenceAPI.get, action, GET_REFERENCE);
}

export function* createReference(action) {
    const extraFunc = {
        closeModal: put(push({ state: { createReference: false } }))
    };
    yield apiCall(referenceAPI.create, action, CREATE_REFERENCE, {}, extraFunc);
}

export function* editReference(action) {
    yield apiCall(referenceAPI.edit, action, EDIT_REFERENCE);
}

export function* removeReference(action) {
    yield setPending(apiCall(referenceAPI.remove, action, REMOVE_REFERENCE));
    yield put(push("/refs"));
}

export function* importReference(action) {
    const extraFunc = {
        closeModal: put(push({ state: { importReference: false } }))
    };
    yield setPending(apiCall(referenceAPI.importReference, action, IMPORT_REFERENCE, {}, extraFunc));
}

export function* cloneReference(action) {
    const extraFunc = {
        closeModal: put(push({ state: { cloneReference: false } }))
    };
    yield setPending(apiCall(referenceAPI.cloneReference, action, CLONE_REFERENCE, {}, extraFunc));
}

export function* remoteReference() {
    yield setPending(
        apiCall(referenceAPI.remoteReference, { remote_from: "virtool/ref-plant-viruses" }, REMOTE_REFERENCE)
    );
    yield put(push({ pathname: "/refs" }));
}

export function* addRefUser(action) {
    yield apiCall(referenceAPI.addUser, action, ADD_REFERENCE_USER);
}

export function* editRefUser(action) {
    yield apiCall(referenceAPI.editUser, action, EDIT_REFERENCE_USER);
}

export function* removeRefUser(action) {
    yield apiCall(referenceAPI.removeUser, action, REMOVE_REFERENCE_USER);
}

export function* addRefGroup(action) {
    yield apiCall(referenceAPI.addGroup, action, ADD_REFERENCE_GROUP);
}

export function* editRefGroup(action) {
    yield apiCall(referenceAPI.editGroup, action, EDIT_REFERENCE_GROUP);
}

export function* removeRefGroup(action) {
    yield apiCall(referenceAPI.removeGroup, action, REMOVE_REFERENCE_GROUP);
}

export function* checkRemoteUpdates(action) {
    yield apiCall(referenceAPI.checkUpdates, action, CHECK_REMOTE_UPDATES);
}

export function* updateRemoteReference(action) {
    yield apiCall(referenceAPI.updateRemote, action, UPDATE_REMOTE_REFERENCE);
}

export function* watchReferences() {
    yield throttle(300, CREATE_REFERENCE.REQUESTED, createReference);
    yield takeEvery(EDIT_REFERENCE.REQUESTED, editReference);
    yield takeLatest(GET_REFERENCE.REQUESTED, getReference);
    yield takeLatest(FIND_REFERENCES.REQUESTED, findReferences);
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
    yield takeEvery(CHECK_REMOTE_UPDATES.REQUESTED, checkRemoteUpdates);
    yield takeEvery(UPDATE_REMOTE_REFERENCE.REQUESTED, updateRemoteReference);
}
