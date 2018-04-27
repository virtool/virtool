import {
    fetchViruses,
    getVirus,
    getVirusHistory,
    createVirus,
    editVirus,
    removeVirus,
    addIsolate,
    setIsolateAsDefault,
    editIsolate,
    removeIsolate,
    addSequence,
    editSequence,
    removeSequence,
    revert,
    uploadImport,
    commitImport,
    selectIsolate,
    showEditVirus,
    showRemoveVirus,
    showAddIsolate,
    showEditIsolate,
    showRemoveIsolate,
    showAddSequence,
    showEditSequence,
    showRemoveSequence,
    hideVirusModal
} from "./actions";
import {
    FETCH_VIRUSES,
    GET_VIRUS,
    GET_VIRUS_HISTORY,
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
    COMMIT_IMPORT,
    SELECT_ISOLATE,
    SHOW_EDIT_VIRUS,
    SHOW_REMOVE_VIRUS,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_VIRUS_MODAL
} from "../actionTypes";

describe("Virus Action Creators:", () => {

    it("fetchViruses: returns simple action", () => {
        const result = fetchViruses();
        const expected = {
            type: "FETCH_VIRUSES"
        };

        expect(result).toEqual(expected);
    });

    it("getVirus: returns action to retrieve virus", () => {
        const virusId = "testid";
        const result = getVirus(virusId);
        const expected = {
            type: "GET_VIRUS_REQUESTED",
            virusId
        };

        expect(result).toEqual(expected);
    });

    it("getVirusHistory: returns action to retrieve virus history of changes", () => {
        const virusId = "testid";
        const result = getVirusHistory(virusId);
        const expected = {
            type: "GET_VIRUS_HISTORY_REQUESTED",
            virusId
        };

        expect(result).toEqual(expected);
    });

    it("createVirus: returns action to create a virus", () => {
        const name = "test";
        const abbreviation = "T";
        const result = createVirus(name, abbreviation);
        const expected = {
            type: "CREATE_VIRUS_REQUESTED",
            name,
            abbreviation
        };

        expect(result).toEqual(expected);
    });

    it("editVirus: returns action to modify a virus", () => {
        const virusId = "testid";
        const name = "test";
        const abbreviation = "T";
        const schema = [];
        const result = editVirus(virusId, name, abbreviation, schema);
        const expected = {
            type: "EDIT_VIRUS_REQUESTED",
            virusId,
            name,
            abbreviation,
            schema
        };

        expect(result).toEqual(expected);
    });

    it("removeVirus: returns action to remove a virus", () => {
        const virusId = "testod";
        const history = {};
        const result = removeVirus(virusId, history);
        const expected = {
            type: "REMOVE_VIRUS_REQUESTED",
            virusId,
            history
        };

        expect(result).toEqual(expected);
    });

    it("addIsolate: returns action to add an isolate to a virus", () => {
        const virusId = "testid";
        const sourceType = "isolate";
        const sourceName = "source"
        const result = addIsolate(virusId, sourceType, sourceName);
        const expected = {
            type: "ADD_ISOLATE_REQUESTED",
            virusId,
            sourceType,
            sourceName
        };

        expect(result).toEqual(expected);
    });

    it("setIsolateAsDefault: returns action to set isolate as default", () => {
        const virusId = "testod";
        const isolateId = "isolateid";
        const result = setIsolateAsDefault(virusId, isolateId);
        const expected = {
            type: "SET_ISOLATE_AS_DEFAULT_REQUESTED",
            virusId,
            isolateId
        };

        expect(result).toEqual(expected);
    });

    it("editIsolate: returns action to modify an isolate", () => {
        const virusId = "testod";
        const isolateId = "isolateid";
        const sourceType = "isolate";
        const sourceName = "source";
        const result = editIsolate(virusId, isolateId, sourceType, sourceName);
        const expected = {
            type: "EDIT_ISOLATE_REQUESTED",
            virusId,
            isolateId,
            sourceType,
            sourceName
        };

        expect(result).toEqual(expected);
    });

    it("removeIsolate: returns action to remove isolate from a virus", () => {
        const virusId = "testod";
        const isolateId = "isolate1";
        const nextIsolateId = "isolate2";
        const result = removeIsolate(virusId, isolateId, nextIsolateId);
        const expected = {
            type: "REMOVE_ISOLATE_REQUESTED",
            virusId,
            isolateId,
            nextIsolateId
        };

        expect(result).toEqual(expected);
    });

    it("addSequence: returns action to add a sequence to an isolate", () => {
        const virusId = "testid";
        const isolateId = "isolateid";
        const sequenceId = "sequenceid";
        const definition = "definition";
        const host = "host";
        const sequence = "sequence";
        const segment = "segment";
        const result = addSequence(virusId, isolateId, sequenceId, definition, host, sequence, segment);
        const expected = {
            type: "ADD_SEQUENCE_REQUESTED",
            virusId,
            isolateId,
            sequenceId,
            definition,
            host,
            sequence,
            segment
        };

        expect(result).toEqual(expected);
    });

    it("editSequence: returns action to modify a sequence", () => {
        const virusId = "testid";
        const isolateId = "isolateid";
        const sequenceId = "sequenceid";
        const definition = "definition";
        const host = "host";
        const sequence = "sequence";
        const segment = "segment";
        const result = editSequence(virusId, isolateId, sequenceId, definition, host, sequence, segment);
        const expected = {
            type: "EDIT_SEQUENCE_REQUESTED",
            virusId,
            isolateId,
            sequenceId,
            definition,
            host,
            sequence,
            segment
        };

        expect(result).toEqual(expected);
    });

    it("removeSequence: returns action to remove a sequence from an isolate", () => {
        const virusId = "testid";
        const isolateId = "isolate";
        const sequenceId = "sequence";
        const result = removeSequence(virusId, isolateId, sequenceId);
        const expected = {
            type: "REMOVE_SEQUENCE_REQUESTED",
            virusId,
            isolateId,
            sequenceId
        };

        expect(result).toEqual(expected);
    });

    it("revert: returns action to discard unbuilt virus changes", () => {
        const virusId = "testid";
        const version = "3";
        const result = revert(virusId, version);
        const expected = {
            type: "REVERT_REQUESTED",
            virusId,
            version
        };

        expect(result).toEqual(expected);
    });

    it("uploadImport: returns action to upload a virus database", () => {
        const file = {};
        const onProgress = jest.fn();
        const result = uploadImport(file, onProgress);
        const expected = {
            type: "UPLOAD_IMPORT_REQUESTED",
            file,
            onProgress
        };

        expect(result).toEqual(expected);
    });

    it("commitImport: returns action to commit a virus database", () => {
        const fileId = "fileid";
        const result = commitImport(fileId);
        const expected = {
            type: "COMMIT_IMPORT_REQUESTED",
            fileId
        };

        expect(result).toEqual(expected);
    });

    it("selectIsolate: returns action to display selected isolate", () => {
        const isolateId = "isolateid";
        const result = selectIsolate(isolateId);
        const expected = {
            type: "SELECT_ISOLATE",
            isolateId
        };

        expect(result).toEqual(expected);
    });

    it("showEditVirus: returns simple action", () => {
        const result = showEditVirus();
        const expected = {
            type: "SHOW_EDIT_VIRUS"
        };

        expect(result).toEqual(expected);
    });

    it("showRemoveVirus: returns simple action", () => {
        const result = showRemoveVirus();
        const expected = {
            type: "SHOW_REMOVE_VIRUS"
        };

        expect(result).toEqual(expected);
    });

    it("showAddIsolate: returns simple action", () => {
        const result = showAddIsolate();
        const expected = {
            type: "SHOW_ADD_ISOLATE"
        };

        expect(result).toEqual(expected);
    });

    it("showEditIsolate: returns action to show edit isolate modal", () => {
        const virusId = "testid";
        const isolateId = "isolateid";
        const sourceType = "isolate";
        const sourceName = "source";
        const result = showEditIsolate(virusId, isolateId, sourceType, sourceName);
        const expected = {
            type: "SHOW_EDIT_ISOLATE",
            virusId,
            isolateId,
            sourceType,
            sourceName
        };

        expect(result).toEqual(expected);
    });

    it("showRemoveIsolate: returns simple action", () => {
        const result = showRemoveIsolate();
        const expected = {
            type: "SHOW_REMOVE_ISOLATE"
        };

        expect(result).toEqual(expected);
    });

    it("showAddSequence: returns simple action", () => {
        const result = showAddSequence();
        const expected = {
            type: "SHOW_ADD_SEQUENCE"
        };

        expect(result).toEqual(expected);
    });

    it("showEditSequence: returns action to show edit sequence modal", () => {
        const sequenceId = "sequenceid";
        const result = showEditSequence(sequenceId);
        const expected = {
            type: "SHOW_EDIT_SEQUENCE",
            sequenceId
        };

        expect(result).toEqual(expected);
    });

    it("showRemoveSequence: returns action to show remove sequence modal", () => {
        const sequenceId = "sequenceid";
        const result = showRemoveSequence(sequenceId);
        const expected = {
            type: "SHOW_REMOVE_SEQUENCE",
            sequenceId
        };

        expect(result).toEqual(expected);
    });

    it("hideVirusModal: returns simple action", () => {
        const result = hideVirusModal();
        const expected = {
            type: "HIDE_VIRUS_MODAL"
        };

        expect(result).toEqual(expected);
    });

});
