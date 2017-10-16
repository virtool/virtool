/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    FIND_SAMPLES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,

    SHOW_EDIT_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL
} from "../actionTypes";

export const findSamples = (term, page) => {
    return {
        type: FIND_SAMPLES.REQUESTED,
        term,
        page
    };
};

export const findReadyHosts = () => {
    return {
        type: FIND_READY_HOSTS.REQUESTED
    };
};

export const getSample = (sampleId) => {
    return {
        type: GET_SAMPLE.REQUESTED,
        sampleId: sampleId
    }
};

export const createSample = (name, isolate, host, locale, subtraction, files) => {
    return {
        type: CREATE_SAMPLE.REQUESTED,
        name,
        isolate,
        host,
        locale,
        subtraction,
        files
    };
};

export const updateSample = (sampleId, update) => {
    return {
        type: UPDATE_SAMPLE.REQUESTED,
        sampleId,
        update
    };
};

export const removeSample = (sampleId) => {
    return {
        type: REMOVE_SAMPLE.REQUESTED,
        sampleId
    };
};

export const showEditSample = () => {
    return {
        type: SHOW_EDIT_SAMPLE
    };
};

export const showRemoveSample = () => {
    return {
        type: SHOW_REMOVE_SAMPLE
    };
};

export const hideSampleModal = () => {
    return {
        type: HIDE_SAMPLE_MODAL
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

export const blastNuvs = (analysisId, sequenceIndex) => {
    return {
        type: BLAST_NUVS.REQUESTED,
        analysisId,
        sequenceIndex
    };
};
