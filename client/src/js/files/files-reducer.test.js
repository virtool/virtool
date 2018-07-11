import reducer, {
    initialState as reducerInitialState,
    checkUploadsComplete
} from "./reducer";
import {
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";
import { reject } from "lodash-es";

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

    it("should handle FIND_FILES_REQUESTED", () => {
        state = initialState;
        action = {
            type: FIND_FILES.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...initialState,
            showUploadOverlay: state.showUploadOverlay,
            uploads: state.uploads,
            uploadsComplete: state.uploadsComplete,
            isLoading: true,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_FILES_SUCCEEDED", () => {
        state = {};
        action = {
            type: FIND_FILES.SUCCEEDED,
            data: {},
            fileType: "test"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            fileType: action.fileType,
            isLoading: false,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle REMOVE_FILE_SUCCEEDED", () => {
        state = {
            documents: [
                { id: "test_file" },
                { id: "another_test_file" }
            ]
        };
        action = {
            type: REMOVE_FILE.SUCCEEDED,
            data: {
                file_id: "test_file"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: reject(state.documents, {id: action.data.file_id})
        };

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
            uploads: state.uploads.concat([{localId: action.localId, progress: 0, name, size, type}]),
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
            }
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
