import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    LIST_FILES,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";
import reducer, { initialState as reducerInitialState, checkUploadsComplete } from "./reducer";

describe("Files Reducer", () => {
    const initialState = reducerInitialState;
    let state;
    let action;
    let result;
    let expected;

    it("should return the initial state on first pass", () => {
        result = reducer(undefined, {});
        expected = initialState;
        expect(result).toEqual(expected);
    });

    it("should return the given state on other action types", () => {
        action = {
            type: "UNHANDLED_ACTION"
        };
        result = reducer(initialState, action);
        expected = initialState;
        expect(result).toEqual(expected);
    });

    describe("should handle WS_INSERT_FILE", () => {
        it("if list is empty or fileType doesn't match, return state", () => {
            state = { fetched: true, fileType: "reads" };
            action = {
                type: WS_INSERT_FILE,
                data: { type: "subtraction" }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("otherwise insert entry into list", () => {
            state = {
                fetched: true,
                fileType: "reads",
                documents: [],
                page: 1,
                per_page: 3,
                total_count: 0
            };
            action = {
                type: WS_INSERT_FILE,
                data: { type: "reads", id: "test" }
            };
            result = reducer(state, action);
            expected = { ...state, documents: [action.data], total_count: 1 };
            expect(result).toEqual(expected);
        });
    });

    it("should handle WS_UPDATE_FILE", () => {
        state = { documents: [{ id: "test", foo: "bar" }] };
        action = {
            type: WS_UPDATE_FILE,
            data: { id: "test", foo: "not-bar" }
        };
        result = reducer(state, action);
        expected = { ...state, documents: [action.data] };
        expect(result).toEqual(expected);
    });

    it("should handle WS_REMOVE_FILE", () => {
        state = { documents: [{ id: "test", foo: "bar" }], total_count: 1 };
        action = {
            type: WS_REMOVE_FILE,
            data: ["test"]
        };
        result = reducer(state, action);
        expected = { ...state, documents: [], refetchPage: false, total_count: 0 };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_FILES_REQUESTED", () => {
        state = initialState;
        action = {
            type: LIST_FILES.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...initialState,
            isLoading: true,
            errorLoad: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_FILES_SUCCEEDED", () => {
        state = { documents: [], page: 0 };
        action = {
            type: LIST_FILES.SUCCEEDED,
            data: { documents: [] },
            fileType: "test"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            fileType: action.fileType,
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle LIST_FILES_FAILED", () => {
        state = {};
        action = { type: LIST_FILES.FAILED };
        result = reducer(state, action);
        expected = { isLoading: false, errorLoad: true };
        expect(result).toEqual(expected);
    });

    it("should handle UPLOAD_REQUESTED", () => {
        state = {
            uploads: []
        };
        action = {
            type: UPLOAD.REQUESTED,
            file: {
                name: "test.fq.gz",
                size: 100,
                type: "reads"
            },
            localId: "testid"
        };
        const { name, size, type } = action.file;

        result = reducer(state, action);
        expected = {
            uploads: state.uploads.concat([{ localId: action.localId, progress: 0, name, size, type }]),
            showUploadOverlay: true,
            uploadsComplete: false
        };
        expect(result).toEqual(expected);
    });

    describe("should handle UPLOAD_PROGRESS", () => {
        it("with no uploads", () => {
            state = {
                uploads: []
            };
            action = {
                type: UPLOAD_PROGRESS,
                localId: "testid",
                progress: 5
            };
            result = reducer(state, action);
            expected = {
                ...state,
                uploadsComplete: true
            };
            expect(result).toEqual(expected);
        });

        it("with incomplete uploads", () => {
            state = {
                uploads: [
                    { localId: "test1", progress: 50 },
                    { localId: "test2", progress: 0 },
                    { localId: "test3", progress: 100 }
                ]
            };
            action = {
                type: UPLOAD_PROGRESS,
                localId: "test2",
                progress: 30
            };
            result = reducer(state, action);
            expected = {
                uploads: [
                    { localId: "test1", progress: 50 },
                    { localId: "test2", progress: 30 },
                    { localId: "test3", progress: 100 }
                ],
                uploadsComplete: false
            };
            expect(result).toEqual(expected);
        });

        it("with complete uploads", () => {
            state = {
                uploads: [
                    { localId: "test1", progress: 90 },
                    { localId: "test2", progress: 100 },
                    { localId: "test3", progress: 100 }
                ]
            };
            action = {
                type: UPLOAD_PROGRESS,
                localId: "test1",
                progress: 100
            };
            result = reducer(state, action);
            expected = {
                uploads: [
                    { localId: "test1", progress: 100 },
                    { localId: "test2", progress: 100 },
                    { localId: "test3", progress: 100 }
                ],
                uploadsComplete: true
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle HIDE_UPLOAD_OVERLAY", () => {
        state = {};
        action = {
            type: HIDE_UPLOAD_OVERLAY
        };
        result = reducer(state, action);
        expected = {
            ...state,
            showUploadOverlay: false
        };
        expect(result).toEqual(expected);
    });

    describe("Files Reducer Helper Functions", () => {
        describe("checkUploadsComplete", () => {
            it("sets [uploadsComplete=true] if all uploads have [progress=100]", () => {
                state = {
                    uploads: [
                        { localId: "test1", progress: 100 },
                        { localId: "test2", progress: 100 },
                        { localId: "test3", progress: 100 }
                    ]
                };
                result = checkUploadsComplete(state);
                expected = {
                    ...state,
                    uploadsComplete: true
                };

                expect(result).toEqual(expected);
            });

            it("sets [uploadsComplete=true] if there are no uploads", () => {
                state = {
                    uploads: []
                };
                result = checkUploadsComplete(state);
                expected = {
                    ...state,
                    uploadsComplete: true
                };

                expect(result).toEqual(expected);
            });

            it("sets [uploadsComplete=false] otherwise", () => {
                state = {
                    uploads: [
                        { localId: "test1", progress: 0 },
                        { localId: "test2", progress: 50 },
                        { localId: "test3", progress: 100 }
                    ]
                };
                result = checkUploadsComplete(state);
                expected = {
                    ...state,
                    uploadsComplete: false
                };

                expect(result).toEqual(expected);
            });
        });
    });
});
