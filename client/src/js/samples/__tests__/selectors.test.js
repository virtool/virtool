import {
    getCanModify,
    getDefaultSubtractions,
    getFilesUndersized,
    getSampleDetail,
    getSampleDetailId,
    getSampleLibraryType
} from "../selectors";

describe("getCanModify()", () => {
    let state;

    beforeEach(() => {
        state = {
            account: {
                id: "fred",
                administrator: false,
                groups: ["foo"]
            },
            samples: {
                detail: {
                    all_write: false,
                    group_write: false,
                    group: "bar",
                    user: {
                        id: "bob"
                    }
                }
            }
        };
    });

    it("should return [false] by default", () => {
        expect(getCanModify(state)).toBe(false);
    });

    it("should return [false] when user is group member but [group_write=false]", () => {
        state.account.groups.push("bar");
        expect(getCanModify(state)).toBe(false);
    });

    it("should return [false] when [group_write=true] but user is not group member", () => {
        state.samples.detail.group_write = true;
        expect(getCanModify(state)).toBe(false);
    });

    it("should return [true] when user is group member and [group_write=true]", () => {
        state.account.groups.push("bar");
        state.samples.detail.group_write = true;
        expect(getCanModify(state)).toBe(true);
    });

    it("should return [true] when [all_write=true]", () => {
        state.samples.detail.all_write = true;
        expect(getCanModify(state)).toBe(true);
    });

    it("should return [true] when user is owner", () => {
        state.samples.detail.user.id = "fred";
        expect(getCanModify(state)).toBe(true);
    });

    it("should return [true] when user is administrator", () => {
        state.account = {
            id: "fred",
            administrator: true,
            groups: []
        };
        expect(getCanModify(state)).toBe(true);
    });
});

describe("getDefaultSubtractions()", () => {
    it("should return sample's default subtraction when defined", () => {
        const state = { samples: { detail: { subtractions: ["bar", "baz"] } } };
        const subtractionIds = getDefaultSubtractions(state);
        expect(subtractionIds).toStrictEqual(["bar", "baz"]);
    });
});

describe("getSampleDetail()", () => {
    it("should return sample detail", () => {
        const state = {
            samples: {
                detail: {
                    id: "foo"
                }
            }
        };
        const detail = getSampleDetail(state);
        expect(detail).toEqual({
            id: "foo"
        });
    });
});

describe("getSampleDetailId()", () => {
    it("should return id when detail loaded", () => {
        const state = {
            samples: {
                detail: {
                    id: "foo"
                }
            }
        };
        const id = getSampleDetailId(state);
        expect(id).toBe("foo");
    });

    it("should return undefined when detail not loaded", () => {
        const state = {
            samples: {
                detail: null
            }
        };
        const id = getSampleDetailId(state);
        expect(id).toBe(undefined);
    });
});

describe("getSampleLibraryType()", () => {
    it("should return libraryType when detail loaded", () => {
        const state = {
            samples: {
                detail: {
                    id: "foo",
                    library_type: "amplicon"
                }
            }
        };
        const libraryType = getSampleLibraryType(state);
        expect(libraryType).toBe("amplicon");
    });

    it("should return undefined when detail not loaded", () => {
        const state = {
            samples: {
                detail: null
            }
        };
        const libraryType = getSampleLibraryType(state);
        expect(libraryType).toBeUndefined();
    });
});

describe("getFilesUndersized()", () => {
    let state;

    beforeEach(() => {
        state = {
            samples: {
                detail: {
                    files: [
                        { id: "foo1", size: 500000000 },
                        { id: "foo2", size: 500000000 }
                    ]
                }
            }
        };
    });

    it("should return false when both files are not undersized", () => {
        const result = getFilesUndersized(state);
        expect(result).toBe(false);
    });

    it("should return true when one file is undersized", () => {
        state.samples.detail.files[0].size = 5000;

        const result = getFilesUndersized(state);
        expect(result).toBe(true);
    });

    it("should return true when both files are undersized", () => {
        state.samples.detail.files[0].size = 5000;
        state.samples.detail.files[1].size = 5000;

        const result = getFilesUndersized(state);
        expect(result).toBe(true);
    });
});
