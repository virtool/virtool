import {
    WS_INSERT_REFERENCE,
    WS_UPDATE_REFERENCE,
    WS_REMOVE_REFERENCE,
    FIND_REFERENCES,
    GET_REFERENCE,
    CREATE_REFERENCE,
    EDIT_REFERENCE,
    REMOVE_REFERENCE,
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
} from "../actionTypes";

export const wsInsertReference = data => ({
    type: WS_INSERT_REFERENCE,
    data
});

export const wsUpdateReference = data => ({
    type: WS_UPDATE_REFERENCE,
    data
});

export const wsRemoveReference = data => ({
    type: WS_REMOVE_REFERENCE,
    data
});

export const findReferences = (term, page = 1) => ({
    type: FIND_REFERENCES.REQUESTED,
    term,
    page
});

export const getReference = refId => ({
    type: GET_REFERENCE.REQUESTED,
    refId
});

export const createReference = (name, description, dataType, organism) => ({
    type: CREATE_REFERENCE.REQUESTED,
    name,
    description,
    dataType,
    organism
});

export const editReference = (refId, update) => ({
    type: EDIT_REFERENCE.REQUESTED,
    refId,
    update
});

export const importReference = (name, description, dataType, organism, fileId) => ({
    type: IMPORT_REFERENCE.REQUESTED,
    name,
    description,
    dataType,
    organism,
    fileId
});

export const cloneReference = (name, description, dataType, organism, refId) => ({
    type: CLONE_REFERENCE.REQUESTED,
    name,
    description,
    dataType,
    organism,
    refId
});

export const remoteReference = () => ({
    type: REMOTE_REFERENCE.REQUESTED
});

export const removeReference = refId => ({
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

export const checkUpdates = refId => ({
    type: CHECK_REMOTE_UPDATES.REQUESTED,
    refId
});

export const updateRemoteReference = refId => ({
    type: UPDATE_REMOTE_REFERENCE.REQUESTED,
    refId
});
