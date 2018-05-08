import { simpleActionCreator } from "../utils";
import {
    LIST_REFERENCES,
    GET_REFERENCE,
    CREATE_REFERENCE,
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

export const importReference = (refId, fileId) => ({
    type: IMPORT_REFERENCE.REQUESTED,
    fileId
});

export const removeReference = (refId) => ({
    type: REMOVE_REFERENCE.REQUESTED,
    refId
});
