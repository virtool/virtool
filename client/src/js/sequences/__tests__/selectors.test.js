import { getActiveSequence, getActiveSequenceId, getSequences, getUnreferencedSegments } from "../selectors";

describe("getSequences()", () => {
    let state;

    beforeEach(() => {
        state = {
            otus: {
                activeIsolateId: null,
                detail: {
                    isolates: [
                        {
                            id: "foo",
                            sequences: [
                                { id: 1, segment: "RNA B" },
                                { id: 2, segment: "RNA A" }
                            ]
                        }
                    ],
                    schema: [{ name: "RNA A" }, { name: "RNA B" }]
                }
            }
        };
    });

    it("should return empty array when no isolate is active", () => {
        const sequences = getSequences(state);
        expect(sequences).toEqual([]);
    });

    it("should return unsorted sequences when segments not assigned", () => {
        state.otus.activeIsolateId = "foo";
        state.otus.detail.isolates[0].sequences = [{ id: 1 }, { id: 2 }];
        const sequences = getSequences(state);
        expect(sequences).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should return sorted sequences when segments assigned", () => {
        state.otus.activeIsolateId = "foo";
        const sequences = getSequences(state);
        expect(sequences).toEqual([
            { id: 2, segment: "RNA A" },
            { id: 1, segment: "RNA B" }
        ]);
    });
});

describe("getActiveSequence()", () => {
    let state;

    beforeEach(() => {
        state = {
            router: { location: { state: { editSequence: "b" } } },
            otus: {
                activeIsolateId: "foo",
                detail: {
                    isolates: [
                        {
                            id: "foo",
                            sequences: [{ id: "b", accession: "bar", definition: "Bar" }]
                        }
                    ]
                }
            }
        };
    });

    it("should return active sequence", () => {
        expect(getActiveSequence(state)).toEqual({ id: "b", accession: "bar", definition: "Bar" });
    });

    it("should return empty object when invalid editSequence location state", () => {
        state.router.location.state = {};
        expect(getActiveSequence(state)).toEqual({});
    });

    it("should return empty object when sequence not found", () => {
        state.otus.detail.isolates[0].sequences = [];
        expect(getActiveSequence(state)).toEqual({});
    });
});

describe("getActiveSequenceId()", () => {
    let state;

    beforeEach(() => {
        state = {
            router: {
                location: {
                    state: {
                        editSequence: false
                    }
                }
            }
        };
    });

    it("should return active sequence ID", () => {
        state.router.location.state.editSequence = "foo";
        expect(getActiveSequenceId(state)).toBe("foo");
    });

    it("should return undefined when editSequence is false", () => {
        expect(getActiveSequenceId(state)).toBeUndefined();
    });

    it("should return undefined when editSequence is not defined", () => {
        state.router.location.state = { addSequence: true };
        expect(getActiveSequenceId(state)).toBeUndefined();
    });
});

describe("getUnreferencedSegments", () => {
    let state;

    beforeEach(() => {
        state = {
            otus: {
                activeIsolateId: "foo",
                detail: {
                    schema: [{ name: "RNA A" }, { name: "RNA B" }, { name: "RNA C" }],
                    isolates: [{ id: "foo", sequences: [{ segment: "RNA B" }] }]
                }
            }
        };
    });

    it("should segments not used in active isolate's sequence list", () => {
        expect(getUnreferencedSegments(state)).toEqual(expect.arrayContaining([{ name: "RNA A" }, { name: "RNA C" }]));
        expect(getUnreferencedSegments(state)).not.toEqual(expect.arrayContaining([{ name: "RNA B" }]));
    });
});
