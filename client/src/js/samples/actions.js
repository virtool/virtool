/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { FIND_SAMPLES, GET_SAMPLE, UPDATE_SAMPLE, FIND_ANALYSES, GET_ANALYSIS, ANALYZE } from "../actionTypes";

export const findSamples = (term, page) => {
    return {
        type: FIND_SAMPLES.REQUESTED,
        term,
        page
    };
};

export const getSample = (sampleId) => {
    return {
        type: GET_SAMPLE.REQUESTED,
        sampleId: sampleId
    }
};

export const updateSample = (sampleId, update) => {
    return {
        type: UPDATE_SAMPLE.REQUESTED,
        sampleId,
        update
    };
};

export const findAnalyses = (sampleId) => {
    return {
        type: FIND_ANALYSES.REQUESTED,
        sampleId
    };
};

export const getAnalysis = (analysisId) => {
    return {
        type: GET_ANALYSIS.REQUESTED,
        analysisId
    };
};

export const analyze = (sampleId, algorithm) => {
    return {
        type: ANALYZE.REQUESTED,
        sampleId,
        algorithm
    };
};
