import { getFilterIds, getMatches, getResults, getSortIds } from "../selectors";

describe("getResults()", () => {
    it("should return formatted results", () => {
        const results = [
            {
                index: 2,
                name: "foo"
            }
        ];
        const state = {
            analyses: {
                detail: {
                    results
                }
            }
        };
        expect(getResults(state)).toEqual(results);
    });
});

describe("getFilterIds()", () => {
    let results;

    beforeEach(() => {
        results = [
            {
                e: 0.000005,
                index: 2,
                name: "foo"
            },
            {
                e: undefined,
                index: 5,
                name: "bar"
            },
            {
                e: 0.00012,
                index: 1,
                name: "baz"
            }
        ];
    });

    it("should return filterIds when filtered", () => {
        const result = getFilterIds.resultFunc(results, true);
        expect(result).toEqual([2, 1]);
    });

    it("should return filterIds when unfiltered", () => {
        const result = getFilterIds.resultFunc(results, false);
        expect(result).toEqual([2, 5, 1]);
    });
});

describe("getSortIds()", () => {
    let state;

    beforeEach(() => {
        state = {
            analyses: {
                sortKey: "length",
                detail: {
                    results: [
                        {
                            index: 0,
                            e: 0.01,
                            annotatedOrfCount: 3,
                            sequence: "ATAATAGGGACACATAA"
                        },
                        {
                            index: 1,
                            e: 3e-22,
                            annotatedOrfCount: 1,
                            sequence: "ATAGATAGGGACACATAGGACACATA"
                        },
                        {
                            index: 2,
                            e: 5e-112,
                            annotatedOrfCount: 2,
                            sequence: "ATAGGATAGGGACACATAATAGGGACACATAGACACATA"
                        },
                        {
                            index: 3,
                            e: 4e-12,
                            annotatedOrfCount: 5,
                            sequence: "ATAGGGACACATA"
                        }
                    ]
                }
            }
        };
    });

    it("should return sorted result ids when sortKey is length", () => {
        expect(getSortIds(state)).toEqual([2, 1, 0, 3]);
    });

    it("should return sorted result ids when sortKey is e", () => {
        state.analyses.sortKey = "e";
        expect(getSortIds(state)).toEqual([2, 1, 3, 0]);
    });

    it("should return sorted result ids when sortKey is orfs", () => {
        state.analyses.sortKey = "orfs";
        expect(getSortIds(state)).toEqual([3, 0, 2, 1]);
    });
});

describe("getMatches()", () => {
    let filterIds;
    let searchIds;
    let sortIds;
    let results;

    beforeEach(() => {
        filterIds = [0, 2];
        searchIds = ["0", "2", "3"];
        sortIds = [2, 3, 0, 1];

        results = [
            {
                index: 0,
                e: 0.01,
                annotatedOrfCount: 3,
                sequence: "ATAATAGGGACACATAA"
            },
            {
                index: 1,
                e: 3e-22,
                annotatedOrfCount: 1,
                sequence: "ATAGATAGGGACACATAGGACACATA"
            },
            {
                index: 2,
                e: 5e-112,
                annotatedOrfCount: 2,
                sequence: "ATAGGATAGGGACACATAATAGGGACACATAGACACATA"
            },
            {
                index: 3,
                e: 4e-12,
                annotatedOrfCount: 5,
                sequence: "ATAGGGACACATA"
            }
        ];
    });

    it("should return ids when restricted by filter", () => {
        expect(getMatches.resultFunc(results, filterIds, searchIds, sortIds)).toEqual([results[2], results[0]]);
    });

    it("should return ids when restricted by search", () => {
        searchIds = ["0", "3"];
        filterIds = [0, 3, 2];
        expect(getMatches.resultFunc(results, filterIds, searchIds, sortIds)).toEqual([results[3], results[0]]);
    });

    it("should return ids when search is null", () => {
        searchIds = null;
        filterIds = [0, 3, 2];
        expect(getMatches.resultFunc(results, filterIds, searchIds, sortIds)).toEqual([
            results[2],
            results[3],
            results[0]
        ]);
    });

    it("should return sorted ids", () => {
        searchIds = null;
        filterIds = [0, 1, 2, 3];
        sortIds = [3, 1, 2, 0];
        expect(getMatches.resultFunc(results, filterIds, searchIds, sortIds)).toEqual([
            results[3],
            results[1],
            results[2],
            results[0]
        ]);
    });
});
