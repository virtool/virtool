import { simpleActionCreator } from "../utils";
import {
    LIST_REFERENCES,
    GET_REFERENCE,
    CREATE_REFERENCE
} from "../actionTypes";

export const listReferences = simpleActionCreator(LIST_REFERENCES);

export const getReference = (referenceId) => ({
    type: GET_REFERENCE.REQUESTED,
    referenceId
});

export const createReference = (name, description) => ({
    type: CREATE_REFERENCE.REQUESTED,
    name,
    description
});
