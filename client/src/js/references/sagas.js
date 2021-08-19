import { push } from "connected-react-router";
import { put, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import { pushState } from "../app/actions";
import {
    ADD_REFERENCE_GROUP,
    ADD_REFERENCE_USER,
    CHECK_REMOTE_UPDATES,
    CLONE_REFERENCE,
    EDIT_REFERENCE,
    EDIT_REFERENCE_GROUP,
    EDIT_REFERENCE_USER,
    EMPTY_REFERENCE,
    FIND_REFERENCES,
    GET_REFERENCE,
    IMPORT_REFERENCE,
    REMOTE_REFERENCE,
    REMOVE_REFERENCE,
    REMOVE_REFERENCE_GROUP,
    REMOVE_REFERENCE_USER,
    UPDATE_REMOTE_REFERENCE
} from "../app/actionTypes";
import { apiCall, pushFindTerm } from "../utils/sagas";
import * as referenceAPI from "./api";

export function* findReferences(action) {
    yield apiCall(referenceAPI.find, action, FIND_REFERENCES);
    yield pushFindTerm(action.term);
}

export function* getReference(action) {
    yield apiCall(referenceAPI.get, action, GET_REFERENCE);
}

export function* emptyReference(action) {
    const extraFunc = {
        closeModal: put(push({ state: { emptyReference: false } }))
    };
    yield apiCall(referenceAPI.create, action, EMPTY_REFERENCE, {}, extraFunc);
    yield put(push("/refs"));
}

export function* editReference(action) {
    yield apiCall(referenceAPI.edit, action, EDIT_REFERENCE);
}

export function* removeReference(action) {
    yield apiCall(referenceAPI.remove, action, REMOVE_REFERENCE);
    yield put(push("/refs"));
}

export function* importReference(action) {
    const extraFunc = {
        closeModal: put(pushState({ importReference: false }))
    };
    yield apiCall(referenceAPI.importReference, action, IMPORT_REFERENCE, {}, extraFunc);
    yield put(push("/refs"));
}

export function* cloneReference(action) {
    const extraFunc = {
        closeModal: put(pushState({ cloneReference: false }))
    };
    yield apiCall(referenceAPI.cloneReference, action, CLONE_REFERENCE, {}, extraFunc);
    yield put(push("/refs"));
}

export function* remoteReference() {
    yield apiCall(referenceAPI.remoteReference, { remote_from: "virtool/ref-plant-viruses" }, REMOTE_REFERENCE);
    yield put(push({ pathname: "/refs" }));
    yield put({ type: FIND_REFERENCES.REQUESTED });
}

export function* addRefUser(action) {
    yield apiCall(referenceAPI.addUser, action, ADD_REFERENCE_USER);
}

export function* editRefUser(action) {
    yield apiCall(referenceAPI.editUser, action, EDIT_REFERENCE_USER);
}

export function* removeRefUser(action) {
    yield apiCall(referenceAPI.removeUser, action, REMOVE_REFERENCE_USER, {
        userId: action.userId,
        refId: action.refId
    });
}

export function* addRefGroup(action) {
    yield apiCall(referenceAPI.addGroup, action, ADD_REFERENCE_GROUP);
}

export function* editRefGroup(action) {
    yield apiCall(referenceAPI.editGroup, action, EDIT_REFERENCE_GROUP);
}

export function* removeRefGroup(action) {
    yield apiCall(referenceAPI.removeGroup, action, REMOVE_REFERENCE_GROUP, {
        groupId: action.groupId,
        refId: action.refId
    });
}

export function* checkRemoteUpdates(action) {
    yield apiCall(referenceAPI.checkUpdates, action, CHECK_REMOTE_UPDATES);
}

export function* updateRemoteReference(action) {
    yield apiCall(referenceAPI.updateRemote, action, UPDATE_REMOTE_REFERENCE);
}

export function* watchReferences() {
    yield throttle(500, EMPTY_REFERENCE.REQUESTED, emptyReference);
    yield throttle(500, IMPORT_REFERENCE.REQUESTED, importReference);
    yield throttle(500, CLONE_REFERENCE.REQUESTED, cloneReference);
    yield throttle(500, REMOTE_REFERENCE.REQUESTED, remoteReference);
    yield takeEvery(EDIT_REFERENCE.REQUESTED, editReference);
    yield takeLatest(GET_REFERENCE.REQUESTED, getReference);
    yield takeLatest(FIND_REFERENCES.REQUESTED, findReferences);
    yield throttle(500, REMOVE_REFERENCE.REQUESTED, removeReference);
    yield takeEvery(ADD_REFERENCE_USER.REQUESTED, addRefUser);
    yield takeEvery(EDIT_REFERENCE_USER.REQUESTED, editRefUser);
    yield takeEvery(REMOVE_REFERENCE_USER.REQUESTED, removeRefUser);
    yield takeEvery(ADD_REFERENCE_GROUP.REQUESTED, addRefGroup);
    yield takeEvery(EDIT_REFERENCE_GROUP.REQUESTED, editRefGroup);
    yield takeEvery(REMOVE_REFERENCE_GROUP.REQUESTED, removeRefGroup);
    yield takeEvery(CHECK_REMOTE_UPDATES.REQUESTED, checkRemoteUpdates);
    yield takeEvery(UPDATE_REMOTE_REFERENCE.REQUESTED, updateRemoteReference);
}
