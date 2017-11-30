/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    FIND_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

export const wsUpdateSubtraction = (data) => {
    return {
        type: WS_UPDATE_SUBTRACTION,
        data
    };
};

export const wsRemoveSubtraction = (subtractionId) => {
    return {
        type: WS_REMOVE_SUBTRACTION,
        subtractionId
    };
};

export const findSubtractions = () => {
    return {
        type: FIND_SUBTRACTIONS.REQUESTED
    };
};

export const listSubtractionIds = () => {
    return {
        type: LIST_SUBTRACTION_IDS.REQUESTED
    };
};

export const getSubtraction = (subtractionId) => {
    return {
        type: GET_SUBTRACTION.REQUESTED,
        subtractionId
    };
};

export const createSubtraction = (subtractionId, fileId) => {
    return {
        type: CREATE_SUBTRACTION.REQUESTED,
        subtractionId,
        fileId
    };
};

export const removeSubtraction = (subtractionId) => {
    return {
        type: REMOVE_SUBTRACTION.REQUESTED,
        subtractionId
    };
};
