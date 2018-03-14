import {
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export const getSubtraction = (subtractionId) => ({
    type: GET_SUBTRACTION.REQUESTED,
    subtractionId
});

export const createSubtraction = (subtractionId, fileId, nickname) => ({
    type: CREATE_SUBTRACTION.REQUESTED,
    subtractionId,
    fileId,
    nickname
});

export const updateSubtraction = (subtractionId, nickname) => ({
    type: UPDATE_SUBTRACTION.REQUESTED,
    subtractionId,
    nickname
});

export const removeSubtraction = (subtractionId) => ({
    type: REMOVE_SUBTRACTION.REQUESTED,
    subtractionId
});
