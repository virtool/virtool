import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY,
    FIND_FILES
} from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState, checkUploadsComplete } from "../reducer";

describe("Files Reducer", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(reducerInitialState);
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const result = reducer(reducerInitialState, action);
        expect(result).toEqual(reducerInitialState);
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
        const state = reducerInitialState;
        const action = {
            type: FIND_FILES.REQUESTED,
            term: "foo",
            page: 5
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...reducerInitialState,
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
        const state = {
            uploads: []
        };
        const action = {
            type: UPLOAD.REQUESTED,
            file: {
                name: "test.fq.gz",
                size: 100,
                type: "reads"
            },
            localId: "foo"
        };
        const { name, size, type } = action.file;

        const result = reducer(state, action);
        expect(result).toEqual({
            uploads: state.uploads.concat([{ localId: action.localId, progress: 0, name, size, type }]),
            showUploadOverlay: true,
            uploadsComplete: false
        });
    });

    describe("should handle UPLOAD_PROGRESS", () => {
        it("with no uploads", () => {
            const state = {
                uploads: []
            };
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "testid",
                progress: 5
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                ...state,
                uploadsComplete: true
            });
        });

        it("with incomplete uploads", () => {
            const state = {
                uploads: [
                    { localId: "test1", progress: 50 },
                    { localId: "test2", progress: 0 },
                    { localId: "test3", progress: 100 }
                ]
            };
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "test2",
                progress: 30
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                uploads: [
                    { localId: "test1", progress: 50 },
                    { localId: "test2", progress: 30 },
                    { localId: "test3", progress: 100 }
                ],
                uploadsComplete: false
            });
        });

        it("with complete uploads", () => {
            const state = {
                uploads: [
                    { localId: "test1", progress: 90 },
                    { localId: "test2", progress: 100 },
                    { localId: "test3", progress: 100 }
                ]
            };
            const action = {
                type: UPLOAD_PROGRESS,
                localId: "test1",
                progress: 100
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                uploads: [
                    { localId: "test1", progress: 100 },
                    { localId: "test2", progress: 100 },
                    { localId: "test3", progress: 100 }
                ],
                uploadsComplete: true
            });
        });
    });

    it("should handle HIDE_UPLOAD_OVERLAY", () => {
        const action = {
            type: HIDE_UPLOAD_OVERLAY
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            showUploadOverlay: false
        });
    });

    describe("Files Reducer Helper Functions", () => {
        describe("checkUploadsComplete", () => {
            it("sets [uploadsComplete=true] if all uploads have [progress=100]", () => {
                const state = {
                    uploads: [
                        { localId: "test1", progress: 100 },
                        { localId: "test2", progress: 100 },
                        { localId: "test3", progress: 100 }
                    ]
                };
                const result = checkUploadsComplete(state);
                expect(result).toEqual({
                    ...state,
                    uploadsComplete: true
                });
            });

            it("sets [uploadsComplete=true] if there are no uploads", () => {
                const state = {
                    uploads: []
                };
                const result = checkUploadsComplete(state);
                expect(result).toEqual({
                    ...state,
                    uploadsComplete: true
                });
            });

            it("sets [uploadsComplete=false] otherwise", () => {
                const state = {
                    uploads: [
                        { localId: "test1", progress: 0 },
                        { localId: "test2", progress: 50 },
                        { localId: "test3", progress: 100 }
                    ]
                };
                const result = checkUploadsComplete(state);
                expect(result).toEqual({
                    ...state,
                    uploadsComplete: false
                });
            });
        });
    });
});
