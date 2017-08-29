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
    GET_SUBTRACTION,
    SHOW_CREATE_SUBTRACTION,
    HIDE_SUBTRACTION_MODAL
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

export const showCreateSubtraction = () => {
    return {
        type: SHOW_CREATE_SUBTRACTION
    };
};

export const hideSubtractionModal = () => {
    return {
        type: HIDE_SUBTRACTION_MODAL
    };
};
