import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    FIND_FILES
} from "../../app/actionTypes";
import reducer, { initialState, cleanUploads } from "../reducer";

describe("filesReducer()", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(initialState);
    });

    describe("should handle WS_INSERT_FILE", () => {
        it("if list is empty or fileType doesn't match, return state", () => {
            const state = { fileType: "reads" };
            const action = {
                type: WS_INSERT_FILE,
                data: { type: "subtraction" }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });

        it("otherwise insert entry into list", () => {
            const state = {
                fetched: true,
                fileType: "reads",
                documents: [],
                page: 1,
                per_page: 3,
                total_count: 0
            };
            const action = {
                type: WS_INSERT_FILE,
                data: { type: "reads", id: "test" }
            };
            const result = reducer(state, action);
            expect(result).toEqual({ ...state, documents: [action.data], total_count: 0 });
        });
    });

    it("should handle WS_UPDATE_FILE", () => {
        const state = {
            documents: [{ id: "test", foo: "bar" }]
        };
        const action = {
            type: WS_UPDATE_FILE,
            data: { id: "test", foo: "not-bar" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, documents: [action.data] });
    });

    it("should handle WS_REMOVE_FILE", () => {
        const state = {
            documents: [{ id: "test", foo: "bar" }],
            total_count: 1
        };
        const action = {
            type: WS_REMOVE_FILE,
            data: ["test"]
        };
        const result = reducer(state, action);
        expect(result).toEqual({ documents: [], total_count: 1 });
    });

    it("should handle LIST_FILES_REQUESTED", () => {
        const state = {};
        const action = {
            type: FIND_FILES.REQUESTED,
            term: "foo",
            page: 5
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            term: "foo"
        });
    });

    it("should handle LIST_FILES_SUCCEEDED", () => {
        const state = { documents: [], page: 1 };
        const action = {
            type: FIND_FILES.SUCCEEDED,
            data: { documents: [] },
            fileType: "test"
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            ...action.data,
            fileType: action.fileType
        });
    });

    it("should handle UPLOAD_REQUESTED", () => {
        const localId = "baz";
        const name = "test.fq.gz";
        const size = 100;
        const type = "foo";
        const context = {
            foo: "bar"
        };

        const state = {
            uploads: []
        };

        const action = {
            type: UPLOAD.REQUESTED,
            localId,
            context,
            fileType: type,
            file: {
                name,
                size
            }
        };

        const result = reducer(state, action);

        expect(result).toEqual({
            uploads: [...state.uploads, { localId, name, context, size, type, progress: 0 }]
        });
    });

    describe("should handle UPLOAD_PROGRESS", () => {
        let state;

        beforeEach(() => {
            state = {
                uploads: [
                    { localId: "foo", progress: 50 },
                    { localId: "bar", progress: 0 },
                    { localId: "baz", progress: 100 }
                ]
            };
        });

        it("when there are no uploads", () => {
            state.uploads = [];
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "foo",
                progress: 5
            };
            expect(reducer(state, action)).toEqual({
                uploads: []
            });
        });

        it("when a zero-progress upload is updated", () => {
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "bar",
                progress: 22
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                uploads: [
                    { localId: "foo", progress: 50 },
                    { localId: "bar", progress: 22 }
                ]
            });
        });

        it("when a partial upload is updated", () => {
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "foo",
                progress: 65
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                uploads: [
                    { localId: "foo", progress: 65 },
                    { localId: "bar", progress: 0 }
                ]
            });
        });

        it("when an update that brings a progress value to 100", () => {
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "foo",
                progress: 100
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                uploads: [{ localId: "bar", progress: 0 }]
            });
        });
    });

    describe("cleanUploads()", () => {
        it("should remove all and only finished uploads", () => {
            const state = {
                uploads: [
                    { localId: "foo", progress: 32 },
                    { localId: "bar", progress: 100 },
                    { localId: "baz", progress: 0 }
                ]
            };

            expect(cleanUploads(state)).toEqual({
                uploads: [state.uploads[0], state.uploads[2]]
            });
        });
    });
});
