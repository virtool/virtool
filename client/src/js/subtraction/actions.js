import { simpleActionCreator } from "../utils";
import {
    FIND_SUBTRACTIONS,
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export const findSubtractions = simpleActionCreator(FIND_SUBTRACTIONS.REQUESTED);

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
