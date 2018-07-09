import {
    wsUpdateSample,
    wsRemoveSample,
    findReadyHosts,
    getSample,
    createSample,
    editSample,
    updateSampleRights,
    removeSample,
    showRemoveSample,
    hideSampleModal
} from "./actions";
import {
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL
} from "../actionTypes";

describe("Sample Action Creators:", () => {

    it("wsUpdateSample: returns action for sample update via websocket", () => {
        const update = {};
        const result = wsUpdateSample(update);
        const expected = {
            type: "WS_UPDATE_SAMPLE",
            update
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveSample: returns action for sample removal via websocket", () => {
        const removed = "";
        const result = wsRemoveSample(removed);
        const expected = {
            type: "WS_REMOVE_SAMPLE",
            removed
        };

        expect(result).toEqual(expected);
    });

    it("findReadyHosts: returns simple action", () => {
        const result = findReadyHosts();
        const expected = {
            type: "FIND_READY_HOSTS_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("getSample: returns action for getting specific sample", () => {
        const sampleId = "testsample";
        const result = getSample(sampleId);
        const expected = {
            type: "GET_SAMPLE_REQUESTED",
            sampleId
        };

        expect(result).toEqual(expected);
    });

    it("createSample: returns action for creating sample", () => {
        const name = "name";
        const isolate = "isolate";
        const host = "host";
        const locale = "locale";
        const srna = false;
        const subtraction = "subtraction";
        const files = {};
        const result = createSample(name, isolate, host, locale, srna, subtraction, files);
        const expected = {
            type: "CREATE_SAMPLE_REQUESTED",
            name,
            isolate,
            host,
            locale,
            srna,
            subtraction,
            files
        };

        expect(result).toEqual(expected);
    });

    it("editSample: returns action for modifying a sample", () => {
        const sampleId = "testid";
        const update = {};
        const result = editSample(sampleId, update);
        const expected = {
            type: "UPDATE_SAMPLE_REQUESTED",
            sampleId,
            update
        };

        expect(result).toEqual(expected);
    });

    it("updateSampleRights: returns action for updating a sample's permissions", () => {
        const sampleId = "testid";
        const update = {};
        const result = updateSampleRights(sampleId, update);
        const expected = {
            type: "UPDATE_SAMPLE_RIGHTS_REQUESTED",
            sampleId,
            update
        };

        expect(result).toEqual(expected);
    });

    it("removeSample: returns action to remove a sample", () => {
        const sampleId = "testid";
        const result = removeSample(sampleId);
        const expected = {
            type: "REMOVE_SAMPLE_REQUESTED",
            sampleId
        };

        expect(result).toEqual(expected);
    });

    it("showRemoveSample: returns simple action", () => {
        const result = showRemoveSample();
        const expected = {
            type: "SHOW_REMOVE_SAMPLE"
        };

        expect(result).toEqual(expected);
    });

    it("hideSampleModal: returns simple action", () => {
        const result = hideSampleModal();
        const expected = {
            type: "HIDE_SAMPLE_MODAL"
        };

        expect(result).toEqual(expected);
    });

});
