import { forEach } from "lodash-es";
import {
    WS_INSERT_OTU,
    WS_UPDATE_OTU,
    WS_REMOVE_OTU,
    WS_UPDATE_STATUS,
    FIND_OTUS,
    GET_OTU,
    EDIT_OTU,
    REMOVE_OTU,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
    UPLOAD_IMPORT,
    SELECT_ISOLATE,
    SHOW_EDIT_OTU,
    SHOW_REMOVE_OTU,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_OTU_MODAL,
    GET_OTU_HISTORY
} from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState, hideOTUModal, getActiveIsolate, receiveOTU } from "../reducer";

describe("OTUs Reducer:", () => {

    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(reducerInitialState);
    });

    it("should return the given state on other action types", () => {
        const action = { type: "UNHANDLED_ACTION" };
        const result = reducer(reducerInitialState, action);
        expect(result).toEqual(reducerInitialState);
    });

    describe("should handle WS_UPDATE_STATUS", () => {
        it("if status id is 'OTU_import', return importData", () => {
            const action = { type: WS_UPDATE_STATUS, data: { id: "OTU_import" } };
            const result = reducer({}, action);
            expect(result).toEqual({ importData: { id: "OTU_import", inProgress: true } });
        });

        it("otherwise return state", () => {
            const state = {};
            const action = { type: WS_UPDATE_STATUS, data: { id: "test" } };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    describe("should handle WS_INSERT_OTU", () => {
        it("if reference ids do not match, return state", () => {
            const state = { refId: "foo" };
            const action = {
                type: WS_INSERT_OTU,
                data: { id: "test", reference: { id: "bar" } }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });

        it("othewise insert new entry into list", () => {
            const state = {
                fetched: true,
                refId: "123abc",
                documents: [],
                page: 0,
                per_page: 3
            };
            const action = {
                type: WS_INSERT_OTU,
                data: { id: "test", reference: { id: "123abc" } }
            };
            const result = reducer(state, action);
            expect(result).toEqual({ ...state, documents: [action.data] });
        });
    });

    describe("should handle WS_UPDATE_OTU", () => {
        it("if reference ids do not match, return state", () => {
            const state = { refId: "foo" };
            const action = {
                type: WS_UPDATE_OTU,
                data: { id: "test", reference: { id: "bar" } }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });

        it("otherwise insert new entry into list", () => {
            const refId = "baz";
            const state = {
                refId,
                documents: [{ id: "test-otu", foo: "bar", reference: { id: refId } }]
            };
            const action = {
                type: WS_UPDATE_OTU,
                data: { id: "test-otu", foo: "baz", reference: { id: refId } }
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                refId,
                documents: [{ id: "test-otu", foo: "baz", reference: { id: refId } }]
            });
        });
    });

    describe("should handle WS_REMOVE_OTU", () => {
        it("no result if otu not found", () => {
            const state = {
                documents: [{id: "foo"}]
            };
            const action = {
                type: WS_REMOVE_OTU,
                data: ["bar"]
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });

        it("otherwise remove matching otu", () => {
            const state = {
                documents: [{ id: "foo" }]
            };
            const action = {
                type: WS_REMOVE_OTU,
                data: ["foo"]
            };
            const result = reducer(state, action);
            expect(result).toEqual({documents: []});
        });
    });

    it("should handle FIND_OTUS_REQUESTED", () => {
        const refId = "baz";
        const term = "foo";
        const action = { type: FIND_OTUS.REQUESTED, refId, term, page: 3 };
        const result = reducer({}, action);
        expect(result).toEqual({ term, refId });
    });

    it("should handle FIND_OTUS_SUCCEEDED", () => {
        const state = { documents: [], page: 1 };
        const action = {
            type: FIND_OTUS.SUCCEEDED,
            data: { documents: [{ id: "test" }], page: 2 }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...action.data,
        });
    });

    it("should handle FIND_OTUS.SUCCEEDED", () => {
        const state = { documents: null };
        const action = { type: FIND_OTUS.SUCCEEDED, data: { documents: [] } };
        const result = reducer(state, action);
        expect(result).toEqual({ documents: [] });
    });

    it("should handle GET_OTU_REQUESTED", () => {
        const state = {};
        const action = { type: GET_OTU.REQUESTED };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...hideOTUModal(state),
            detail: null,
            activeIsolateId: null
        });
    });

    it("should handle REMOVE_OTU_SUCCEEDED", () => {
        const state = {};
        const action = { type: REMOVE_OTU.SUCCEEDED };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...hideOTUModal(state),
            detail: null,
            activeIsolateId: null
        });
    });

    describe("Actions that close all modals: ", () => {
        const actionList = [
            GET_OTU.SUCCEEDED,
            EDIT_OTU.SUCCEEDED,
            EDIT_ISOLATE.SUCCEEDED,
            ADD_SEQUENCE.SUCCEEDED,
            EDIT_SEQUENCE.SUCCEEDED,
            REMOVE_SEQUENCE.SUCCEEDED,
            SET_ISOLATE_AS_DEFAULT.SUCCEEDED,
            ADD_ISOLATE.SUCCEEDED,
            REMOVE_ISOLATE.SUCCEEDED
        ];

        forEach(actionList, actionType => {
            it(`should handle ${actionType}`, () => {
                const action = {
                    type: actionType,
                    data: { id: "test-otu", isolates: [] }
                };
                const result = reducer({}, action);
                expect(result).toEqual({
                    detail: action.data,
                    ...hideOTUModal({}),
                    activeIsolate: null,
                    activeIsolateId: null
                });
            });
        });
    });

    it("should handle GET_OTU_HISTORY_REQUESTED", () => {
        const action = { type: GET_OTU_HISTORY.REQUESTED };
        const result = reducer({}, action);
        expect(result).toEqual({ detailHistory: null });
    });

    it("should handle GET_OTU_HISTORY_SUCCEEDED", () => {
        const action = {
            type: GET_OTU_HISTORY.SUCCEEDED,
            data: { foo: "bar" }
        };
        const result = reducer({}, action);
        expect(result).toEqual({ detailHistory: { foo: "bar" } });
    });

    it("should handle REVERT_SUCCEEDED", () => {
        const action = {
            type: REVERT.SUCCEEDED,
            data: { isolates: [] },
            history: {}
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            detail: { isolates: [] },
            detailHistory: {},
            activeIsolate: null,
            activeIsolateId: null
        });
    });

    it("should handle UPLOAD_IMPORT.SUCCEEDED", () => {
        const action = {
            type: UPLOAD_IMPORT.SUCCEEDED,
            data: { foo: "bar" }
        };
        const result = reducer({}, action);
        expect(result).toEqual({ importData: { foo: "bar", inProgress: false } });
    });

    it("should handle SELECT_ISOLATE", () => {
        const state = { detail: { isolates: [{ id: "test-isolate" }] } };
        const action = {
            type: SELECT_ISOLATE,
            isolateId: "test-isolate"
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            activeIsolate: { id: "test-isolate" },
            activeIsolateId: "test-isolate"
        });
    });

    it("should handle SHOW_EDIT_OTU", () => {
        const action = { type: SHOW_EDIT_OTU };
        const result = reducer({}, action);
        expect(result).toEqual({ edit: true });
    });

    it("should handle SHOW_REMOVE_OTU", () => {
        const action = { type: SHOW_REMOVE_OTU };
        const result = reducer({}, action);
        expect(result).toEqual({ remove: true });
    });

    it("should handle SHOW_ADD_ISOLATE", () => {
        const action = { type: SHOW_ADD_ISOLATE };
        const result = reducer({}, action);
        expect(result).toEqual({ addIsolate: true });
    });

    it("should handle SHOW_EDIT_ISOLATE", () => {
        const action = { type: SHOW_EDIT_ISOLATE };
        const result = reducer({}, action);
        expect(result).toEqual({ editIsolate: true });
    });

    it("should handle SHOW_REMOVE_ISOLATE", () => {
        const action = { type: SHOW_REMOVE_ISOLATE };
        const result = reducer({}, action);
        expect(result).toEqual({ removeIsolate: true });
    });

    it("should handle SHOW_ADD_SEQUENCE", () => {
        const action = { type: SHOW_ADD_SEQUENCE };
        const result = reducer({}, action);
        expect(result).toEqual({ addSequence: true });
    });

    it("should handle SHOW_EDIT_SEQUENCE", () => {
        const action = { type: SHOW_EDIT_SEQUENCE, sequenceId: "test-sequence" };
        const result = reducer({}, action);
        expect(result).toEqual({ editSequence: "test-sequence" });
    });

    it("should handle SHOW_REMOVE_SEQUENCE", () => {
        const action = { type: SHOW_REMOVE_SEQUENCE, sequenceId: "test-sequence" };
        const result = reducer({}, action);
        expect(result).toEqual({ removeSequence: "test-sequence" });
    });

    it("should handle HIDE_OTU_MODAL", () => {
        const state = {};
        const action = { type: HIDE_OTU_MODAL };
        const result = reducer(state, action);
        expect(result).toEqual({ ...hideOTUModal(state) });
    });

    describe("Helper functions:", () => {
        describe("getActiveIsolate():", () => {
            it("if isolates array is empty, return state with null activeIsolate values", () => {
                const state = { detail: { isolates: [] } };
                const result = getActiveIsolate(state);
                expect(result).toEqual({
                    ...state,
                    activeIsolate: null,
                    activeIsolateId: null
                });
            });

            it("otherwise get current activeIsolateId that defaults to first isolate", () => {
                const state = { detail: { isolates: [{ id: "isolate" }] } };
                const result = getActiveIsolate(state);
                expect(result).toEqual({
                    ...state,
                    activeIsolate: { id: "isolate" },
                    activeIsolateId: "isolate"
                });
            });
        });

        it("receiveOTU(): replace state.detail with action data and reformat isolates", () => {
            const action = {
                data: {
                    isolates: [{ id: "123abc", sourceType: "isolate", sourceName: "tester" }]
                }
            };
            const result = receiveOTU({}, action);
            expect(result).toEqual({
                activeIsolate: {
                    id: "123abc",
                    sourceType: "isolate",
                    sourceName: "tester",
                    name: "Isolate tester"
                },
                activeIsolateId: "123abc",
                detail: {
                    isolates: [{ ...action.data.isolates[0], name: "Isolate tester" }]
                }
            });
        });
    });
});
