import { simpleActionCreator } from "../utils";
import {
    LIST_REFERENCES,
    GET_REFERENCE,
    CREATE_REFERENCE,
    EDIT_REFERENCE,
    REMOVE_REFERENCE,
    IMPORT_REFERENCE,
    CLONE_REFERENCE,
    ADD_REFERENCE_USER,
    EDIT_REFERENCE_USER,
    REMOVE_REFERENCE_USER,
    ADD_REFERENCE_GROUP,
    EDIT_REFERENCE_GROUP,
    REMOVE_REFERENCE_GROUP
} from "../actionTypes";

export const listReferences = simpleActionCreator(LIST_REFERENCES);

export const getReference = (referenceId) => ({
    type: GET_REFERENCE.REQUESTED,
    referenceId
});

export const createReference = (name, description, dataType, organism, isPublic) => ({
    type: CREATE_REFERENCE.REQUESTED,
    name,
    description,
    dataType,
    organism,
    isPublic
});

export const editReference = (referenceId, update) => ({
    type: EDIT_REFERENCE.REQUESTED,
    referenceId,
    update
});

export const importReference = (name, description, dataType, organism, isPublic, fileId) => ({
    type: IMPORT_REFERENCE.REQUESTED,
    name,
    description,
    dataType,
    organism,
    isPublic,
    fileId
});

export const cloneReference = (name, description, dataType, organism, isPublic, refId) => ({
    type: CLONE_REFERENCE.REQUESTED,
    name,
    description,
    dataType,
    organism,
    isPublic,
    refId
});

export const removeReference = (refId) => ({
    type: REMOVE_REFERENCE.REQUESTED,
    refId
});

export const addReferenceUser = (refId, user) => ({
    type: ADD_REFERENCE_USER.REQUESTED,
    refId,
    user
});

export const editReferenceUser = (refId, userId, update) => ({
    type: EDIT_REFERENCE_USER.REQUESTED,
    refId,
    userId,
    update
});

export const removeReferenceUser = (refId, userId) => ({
    type: REMOVE_REFERENCE_USER.REQUESTED,
    refId,
    userId
});

export const addReferenceGroup = (refId, group) => ({
    type: ADD_REFERENCE_GROUP.REQUESTED,
    refId,
    group
});

export const editReferenceGroup = (refId, groupId, update) => ({
    type: EDIT_REFERENCE_GROUP.REQUESTED,
    refId,
    groupId,
    update
});

export const removeReferenceGroup = (refId, groupId) => ({
    type: REMOVE_REFERENCE_GROUP.REQUESTED,
    refId,
    groupId
});
