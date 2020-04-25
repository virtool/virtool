import Fuse from "fuse.js";
import { filter, find, get, intersection, keyBy, map, reject, sortBy, toNumber, toString } from "lodash-es";
import { createSelector } from "reselect";
import { getMaxReadLength, getSampleLibraryType } from "../samples/selectors";
import { fuseSearchKeys } from "./utils";

const getReadCount = state => state.analyses.detail.read_count;

export const getActiveId = state => state.analyses.activeId;

export const getWorkflow = state => state.analyses.detail.workflow;

export const getAnalysisDetailId = state => get(state, "analyses.detail.id", null);

export const getResults = state => state.analyses.detail.results;

export const getMaxSequenceLength = state => state.analyses.detail.maxSequenceLength;

/**
 * Return a Fuse object for searching through results given an workflow name. The workflow will determine which keys the
 * search runs over.
 *
 */
export const getFuse = createSelector([getWorkflow, getResults], (workflow, results) => {
    const keys = fuseSearchKeys[workflow];

    return new Fuse(results, {
        keys,
        id: "id",
        minMatchCharLength: 2,
        threshold: 0.3,
        tokenize: true
    });
});

export const getFilterOTUs = state => state.analyses.filterOTUs;
export const getFilterSequences = state => state.analyses.filterSequences;
export const getFilterAODP = state => state.analyses.filterAODP;

export const getFilterIds = createSelector(
    [getFilterAODP, getWorkflow, getResults, getFilterOTUs, getFilterSequences, getMaxReadLength, getReadCount],
    (aodpFilter, workflow, results, filterOTUs, filterSequences, maxReadLength, readCount) => {
        if (workflow === "nuvs") {
            const filteredResults = filterSequences ? reject(results, { e: undefined }) : results;
            return map(filteredResults, "id");
        }

        if (workflow === "pathoscope_bowtie" && filterOTUs) {
            const filteredResults = reject(results, hit => {
                return hit.pi * readCount < (hit.length * 0.8) / maxReadLength;
            });

            return map(filteredResults, "id");
        }

        if (workflow === "aodp" && aodpFilter) {
            const filteredResults = filter(results, result => {
                if (result.identity > aodpFilter * 100) {
                    return result.id;
                }
            });

            return map(filteredResults, fi => fi.id);
        }

        return map(results, "id");
    }
);

const getReadyIndexes = state => state.analyses.readyIndexes;

export const getCompatibleReadyIndexes = createSelector(
    [getSampleLibraryType, getReadyIndexes],
    (libraryType, readyIndexes) => {
        return filter(readyIndexes, index => {
            if (index.reference.data_type === "barcode") {
                return libraryType === "amplicon";
            }

            return libraryType === "normal" || libraryType === "srna";
        });
    }
);

export const getSearchIds = state => state.analyses.searchIds;

export const getSortKey = state => state.analyses.sortKey;

export const getSortIds = createSelector([getWorkflow, getResults, getSortKey], (workflow, results, sortKey) => {
    switch (sortKey) {
        case "e":
            return map(sortBy(results, "e"), "id");

        case "orfs":
            return map(sortBy(results, "annotatedOrfCount").reverse(), "id");

        case "length":
            return map(sortBy(results, "sequence.length").reverse(), "id");

        case "depth":
            return map(sortBy(results, "depth").reverse(), "id");

        case "coverage":
            return map(sortBy(results, "coverage").reverse(), "id");

        case "weight":
            return map(sortBy(results, "pi").reverse(), "id");

        case "identity":
            return map(sortBy(results, "identity").reverse(), "id");

        default:
            return map(results, "id");
    }
});

export const getMatches = createSelector(
    [getWorkflow, getResults, getFilterIds, getSearchIds, getSortIds],
    (workflow, results, filterIds, searchIds, sortIds) => {
        let matchIds;

        if (searchIds) {
            matchIds = intersection(sortIds, filterIds, map(searchIds, workflow === "nuvs" ? toNumber : toString));
        } else {
            matchIds = intersection(sortIds, filterIds);
        }

        const keyed = keyBy(results, "id");

        return map(matchIds, id => keyed[id]);
    }
);

export const getActiveHit = createSelector([getWorkflow, getMatches, getActiveId], (workflow, matches, activeId) => {
    if (activeId !== null) {
        const hit = find(matches, { id: activeId });

        if (hit) {
            return hit;
        }
    }

    return matches[0] || null;
});
