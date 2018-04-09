import reducer, {
    initialState as reducerInitialState,
    hideVirusModal,
    getActiveIsolate,
    receiveVirus
} from "./reducer";
import {
    WS_UPDATE_STATUS,
    FIND_VIRUSES,
    GET_VIRUS,
    CREATE_VIRUS,
    EDIT_VIRUS,
    REMOVE_VIRUS,
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
    SHOW_EDIT_VIRUS,
    SHOW_REMOVE_VIRUS,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_VIRUS_MODAL,
    GET_VIRUS_HISTORY
} from "../actionTypes";

describe("Virus Reducer", () => {

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

    describe("should handle WS_UPDATE_STATUS", () => {

        it("when [action.data.id='virus_import'], return import data", () => {
            state = {
                importData: {}
            };
            action = {
                type: "WS_UPDATE_STATUS",
                data: {
                    id: "virus_import"
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                importData: {
                    ...state.importData,
                    ...action.data,
                    inProgress: true
                }
            };

            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = {
                type: "WS_UPDATE_STATUS",
                data: {
                    id: "not_virus_import"
                }
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

    });

    it("should handle FIND_VIRUSES_REQUESTED", () => {
        state = {};
        action = {
            type: "FIND_VIRUSES_REQUESTED",
            terms: "search_terms"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.terms
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_VIRUSES_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_VIRUSES_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_VIRUS_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_VIRUS_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            activeIsolateId: null,
            edit: false,
            remove: false,
            addIsolate: false,
            editIsolate: false,
            removeIsolate: false,
            addSequence: false,
            editSequence: false,
            removeSequence: false
        };
    });

    it("should handle REMOVE_VIRUS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "REMOVE_VIRUS_SUCCEEDED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            activeIsolateId: null,
            edit: false,
            remove: false,
            addIsolate: false,
            editIsolate: false,
            removeIsolate: false,
            addSequence: false,
            editSequence: false,
            removeSequence: false
        };
    });

    describe("These actions should hide the virus modal after getting the virus", () => {

        it("should handle GET_VIRUS_SUCCEEDED", () => {
            state={};
            action = {
                type: "GET_VIRUS_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle EDIT_VIRUS_SUCCEEDED", () => {
            state={};
            action = {
                type: "EDIT_VIRUS_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle EDIT_ISOLATE_SUCCEEDED", () => {
            state={};
            action = {
                type: "EDIT_ISOLATE_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle ADD_SEQUENCE_SUCCEEDED", () => {
            state={};
            action = {
                type: "ADD_SEQUENCE_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle EDIT_SEQUENCE_SUCCEEDED", () => {
            state={};
            action = {
                type: "EDIT_SEQUENCE_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle REMOVE_SEQUENCE_SUCCEEDED", () => {
            state={};
            action = {
                type: "REMOVE_SEQUENCE_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle SET_ISOLATE_AS_DEFAULT_SUCCEEDED", () => {
            state={};
            action = {
                type: "SET_ISOLATE_AS_DEFAULT_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle ADD_ISOLATE_SUCCEEDED", () => {
            state={};
            action = {
                type: "ADD_ISOLATE_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

        it("should handle REMOVE_ISOLATE_SUCCEEDED", () => {
            state={};
            action = {
                type: "REMOVE_ISOLATE_SUCCEEDED",
                data: {
                    isolates: []
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                activeIsolate: null,
                activeIsolateId: null,
                detail: { isolates: [] },
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                addSequence: false,
                editSequence: false,
                removeSequence: false
            };

            expect(result).toEqual(expected);
        });

    });

    it("should handle GET_VIRUS_HISTORY_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_VIRUS_HISTORY_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detailHistory: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_VIRUS_HISTORY_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_VIRUS_HISTORY_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detailHistory: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle REVERT_SUCCEEDED", () => {
        state = {};
        action = {
            type: "REVERT_SUCCEEDED",
            data: {
                isolates: []
            },
            history: [
                { id: "test1" },
                { id: "test2" }
            ]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: { isolates: [] },
            activeIsolate: null,
            activeIsolateId: null,
            detailHistory: action.history
        };
    });

    it("should handle UPLOAD_IMPORT_SUCCEEDED", () => {
        state = {};
        action = {
            type: "UPLOAD_IMPORT_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            importData: { ...action.data, inProgress: false }
        };

        expect(result).toEqual(expected);
    });

    it("should handle SELECT_ISOLATE", () => {
        state = {
            detail: {
                isolates: [
                    { id: "isolate1" },
                    { id: "isolate2" }
                ]
            }
        };
        action = {
            type: "SELECT_ISOLATE",
            isolateId: "isolate2"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            activeIsolate: { id: "isolate2" },
            activeIsolateId: action.isolateId
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_EDIT_VIRUS", () => {
        state = {};
        action = {
            type: "SHOW_EDIT_VIRUS"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            edit: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_VIRUS", () => {
        state = {};
        action = {
            type: "SHOW_REMOVE_VIRUS"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            remove: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_ADD_ISOLATE", () => {
        state = {};
        action = {
            type: "SHOW_ADD_ISOLATE"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            addIsolate: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_EDIT_ISOLATE", () => {
        state = {};
        action = {
            type: "SHOW_EDIT_ISOLATE"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            editIsolate: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_ISOLATE", () => {
        state = {};
        action = {
            type: "SHOW_REMOVE_ISOLATE"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            removeIsolate: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_ADD_SEQUENCE", () => {
        state = {};
        action = {
            type: "SHOW_ADD_SEQUENCE"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            addSequence: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_EDIT_SEQUENCE", () => {
        state = {};
        action = {
            type: "SHOW_EDIT_SEQUENCE",
            sequenceId: "testid"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            editSequence: action.sequenceId
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_SEQUENCE", () => {
        state = {};
        action = {
            type: "SHOW_REMOVE_SEQUENCE",
            sequenceId: "testid"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            removeSequence: action.sequenceId
        };

        expect(result).toEqual(expected);
    });

    it("should handle HIDE_VIRUS_MODAL", () => {
        state = {};
        action = {
            type: "HIDE_VIRUS_MODAL"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...state,
            edit: false,
            remove: false,
            addIsolate: false,
            editIsolate: false,
            removeIsolate: false,
            addSequence: false,
            editSequence: false,
            removeSequence: false
        };

        expect(result).toEqual(expected);
    });

    describe("Viruses Reducer Helper Functions", () => {

        describe("hideVirusModal", () => {

            it("returns a set of state properties set to false", () => {
                state = {};
                result = hideVirusModal(state);
                expected = {
                    ...state,
                    edit: false,
                    remove: false,
                    addIsolate: false,
                    editIsolate: false,
                    removeIsolate: false,
                    addSequence: false,
                    editSequence: false,
                    removeSequence: false
                };

                expect(result).toEqual(expected);
            });

        });

        describe("getActiveIsolate", () => {

            it("when the isolates list is non-empty, return active isolate", () => {
                state = {
                    detail: {
                        isolates: [
                            { id: "testid" }
                        ]
                    }
                };
                result = getActiveIsolate(state);
                expected = {
                    ...state,
                    activeIsolate: { id: "testid" },
                    activeIsolateId: "testid"
                };
                
                expect(result).toEqual(expected);
            });

            it("otherwise return null active isolate information", () => {
                state = {
                    detail: {
                        isolates: []
                    }
                };
                result = getActiveIsolate(state);
                expected = {
                    ...state,
                    activeIsolate: null,
                    activeIsolateId: null
                };
                
                expect(result).toEqual(expected);
            });

        });

        describe("receiveVirus", () => {

            it("returns with active isolate information from successfully retrieved virus", () => {
                state = {};
                action = {
                    data: {
                        isolates: [
                            { id: "test1" },
                            { id: "test2" },
                            { id: "test3" }
                        ]
                    }
                };
                result = receiveVirus(state, action);
                expected = {
                    ...state,
                    detail: { isolates: [] },
                    activeIsolate: null,
                    activeIsolateId: null
                };
            });

        });
    });

});
