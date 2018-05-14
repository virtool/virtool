import { simpleActionCreator } from "../utils";
import {
    LIST_REFERENCES,
    GET_REFERENCE,
    CREATE_REFERENCE,
    EDIT_REFERENCE,
    REMOVE_REFERENCE,
    IMPORT_REFERENCE
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

export const removeReference = (refId) => ({
    type: REMOVE_REFERENCE.REQUESTED,
    refId
});
