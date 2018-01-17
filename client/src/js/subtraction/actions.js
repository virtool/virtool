import {
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export const getSubtraction = (subtractionId) => ({
    type: GET_SUBTRACTION.REQUESTED,
    subtractionId
});

export const createSubtraction = (subtractionId, fileId) => ({
    type: CREATE_SUBTRACTION.REQUESTED,
    subtractionId,
    fileId
});

export const removeSubtraction = (subtractionId) => ({
    type: REMOVE_SUBTRACTION.REQUESTED,
    subtractionId
});
