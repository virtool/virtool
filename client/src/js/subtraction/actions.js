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
    GET_SUBTRACTION
} from "../actionTypes";

export const wsUpdateSubtraction = (data) => {
    return {
        type: WS_UPDATE_SUBTRACTION,
        data
    };
};

export const wsRemoveSubtraction = (hostId) => {
    return {
        type: WS_REMOVE_SUBTRACTION,
        hostId
    };
};

export const findSubtractions = () => {
    return {
        type: FIND_SUBTRACTIONS.REQUESTED
    };
};

export const getSubtraction = (subtractionId) => {
    return {
        type: GET_SUBTRACTION.REQUESTED,
        subtractionId
    };
};

export const removeSubtraction = (hostId) => {
    return {
        type: GET_SUBTRACTION.REQUESTED,
        hostId
    };
};
