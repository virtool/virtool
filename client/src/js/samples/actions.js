/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { FIND_SAMPLES, GET_SAMPLE } from "../actionTypes";

export const findSamples = (term) => {
    return {
        type: FIND_SAMPLES.REQUESTED,
        term: term
    };
};

export const getSample = (sampleId) => {
    return {
        type: GET_SAMPLE.REQUESTED,
        sampleId: sampleId
    }
};