import { simpleActionCreator } from "../utils";
import {
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    FIND_SAMPLES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_GROUP,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL
} from "../actionTypes";

export const wsUpdateSample = (update) => ({
    type: WS_UPDATE_SAMPLE,
    update
});

export const wsRemoveSample = (removed) => ({
    type: WS_REMOVE_SAMPLE,
    removed
});

export const wsUpdateAnalysis = (update) => ({
    type: WS_UPDATE_ANALYSIS,
    update
});

export const wsRemoveAnalysis = (removed) => ({
    type: WS_REMOVE_ANALYSIS,
    removed
});

export const findSamples = simpleActionCreator(FIND_SAMPLES.REQUESTED);

export const findReadyHosts = simpleActionCreator(FIND_READY_HOSTS.REQUESTED);

export const getSample = (sampleId) => ({
    type: GET_SAMPLE.REQUESTED,
    sampleId
});

export const createSample = (name, isolate, host, locale, subtraction, files) => ({
    type: CREATE_SAMPLE.REQUESTED,
    name,
    isolate,
    host,
    locale,
    subtraction,
    files
});

export const editSample = (sampleId, update) => ({
    type: UPDATE_SAMPLE.REQUESTED,
    sampleId,
    update
});

export const updateSampleGroup = (sampleId, groupId) => ({
    type: UPDATE_SAMPLE_GROUP.REQUESTED,
    sampleId,
    groupId
});

export const updateSampleRights = (sampleId, update) => ({
    type: UPDATE_SAMPLE_RIGHTS.REQUESTED,
    sampleId,
    update
});

export const removeSample = (sampleId) => ({
    type: REMOVE_SAMPLE.REQUESTED,
    sampleId
});

export const showRemoveSample = simpleActionCreator(SHOW_REMOVE_SAMPLE);

export const hideSampleModal = simpleActionCreator(HIDE_SAMPLE_MODAL);

export const findAnalyses = (sampleId) => ({
    type: FIND_ANALYSES.REQUESTED,
    sampleId
});

export const getAnalysis = (analysisId) => ({
    type: GET_ANALYSIS.REQUESTED,
    analysisId
});

export const analyze = (sampleId, algorithm) => ({
    type: ANALYZE.REQUESTED,
    sampleId,
    algorithm
});

export const blastNuvs = (analysisId, sequenceIndex) => ({
    type: BLAST_NUVS.REQUESTED,
    analysisId,
    sequenceIndex
});

export const removeAnalysis = (analysisId) => ({
    type: REMOVE_ANALYSIS.REQUESTED,
    analysisId
});
