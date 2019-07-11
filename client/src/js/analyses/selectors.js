import Fuse from "fuse.js";
import { intersection, map, reject, sortBy, toNumber } from "lodash-es";
import { createSelector } from "reselect";

export const getResults = state => state.analyses.data.results;

export const getFuse = createSelector(
    [getResults],
    results =>
        new Fuse(results, {
            keys: ["families", "names"],
            id: "index",
            minMatchCharLength: 2,
            threshold: 0.3,
            tokenize: true
        })
);

export const getFilterSequences = state => state.analyses.filterSequences;

export const getFilterIds = createSelector(
    [getResults, getFilterSequences],
    (results, filterSequences) => {
        const filteredResults = filterSequences ? reject(results, { e: undefined }) : results;
        return map(filteredResults, "index");
    }
);

export const getSearchIds = state => state.analyses.searchIds;

export const getSortKey = state => state.analyses.sortKey;

export const getSortIds = createSelector(
    [getResults, getSortKey],
    (results, sortKey) => {
        if (sortKey === "e") {
            return map(sortBy(results, "e"), "index");
        }

        if (sortKey === "orfs") {
            return map(sortBy(results, "annotatedOrfCount").reverse(), "index");
        }

        return map(sortBy(results, "sequence.length").reverse(), "index");
    }
);

export const getMatches = createSelector(
    [getResults, getFilterIds, getSearchIds, getSortIds],
    (results, filterIds, searchIds, sortIds) => {
        let matchIds;

        if (searchIds) {
            matchIds = intersection(sortIds, filterIds, map(searchIds, toNumber));
        } else {
            matchIds = intersection(sortIds, filterIds);
        }

        return map(matchIds, id => results[id]);
    }
);
