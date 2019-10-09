import {
    CREATE_SAMPLE,
    FIND_READ_FILES,
    FIND_SAMPLES,
    GET_SAMPLE,
    HIDE_SAMPLE_MODAL,
    REMOVE_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    WS_INSERT_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_SAMPLE
} from "../../app/actionTypes";
import {
    createSample,
    editSample,
    findReadFiles,
    findSamples,
    getSample,
    hideSampleModal,
    removeSample,
    showRemoveSample,
    updateSampleRights,
    wsInsertSample,
    wsRemoveSample,
    wsUpdateSample
} from "../actions";

describe("Sample Action Creators:", () => {
    const sampleId = "foo";

    it("wsInsertSample", () => {
        const data = {
            id: "abc123",
            name: "test"
        };
        const result = wsInsertSample(data);
        expect(result).toEqual({
            type: WS_INSERT_SAMPLE,
            data
        });
    });

    it("wsUpdateSample", () => {
        const data = {
            id: "abc123",
            name: "test-edited"
        };
        const result = wsUpdateSample(data);
        expect(result).toEqual({
            type: WS_UPDATE_SAMPLE,
            data
        });
    });

    it("wsRemoveSample", () => {
        const data = ["test"];
        const result = wsRemoveSample(data);
        expect(result).toEqual({
            type: WS_REMOVE_SAMPLE,
            data
        });
    });

    it("findSamples", () => {
        const term = "foo";
        const page = 1;
        const pathoscope = [false];
        const nuvs = ["ip", true];

        const result = findSamples(term, page, pathoscope, nuvs);

        expect(result).toEqual({
            type: FIND_SAMPLES.REQUESTED,
            term,
            page,
            pathoscope,
            nuvs
        });
    });

    it("findReadFiles", () => {
        expect(findReadFiles()).toEqual({
            type: FIND_READ_FILES.REQUESTED
        });
    });

    it("getSample", () => {
        const result = getSample(sampleId);
        expect(result).toEqual({
            type: GET_SAMPLE.REQUESTED,
            sampleId
        });
    });

    it("createSample", () => {
        const name = "name";
        const isolate = "isolate";
        const host = "host";
        const locale = "locale";
        const srna = false;
        const subtraction = "subtraction";
        const files = {};
        const result = createSample(name, isolate, host, locale, srna, subtraction, files);
        expect(result).toEqual({
            type: CREATE_SAMPLE.REQUESTED,
            name,
            isolate,
            host,
            locale,
            srna,
            subtraction,
            files
        });
    });

    it("editSample", () => {
        const update = { foo: "bar" };
        const result = editSample(sampleId, update);
        expect(result).toEqual({
            type: UPDATE_SAMPLE.REQUESTED,
            sampleId,
            update
        });
    });

    it("updateSampleRights", () => {
        const update = { foo: "bar" };
        const result = updateSampleRights(sampleId, update);
        expect(result).toEqual({
            type: UPDATE_SAMPLE_RIGHTS.REQUESTED,
            sampleId,
            update
        });
    });

    it("removeSample", () => {
        const result = removeSample(sampleId);
        expect(result).toEqual({
            type: REMOVE_SAMPLE.REQUESTED,
            sampleId
        });
    });

    it("showRemoveSample", () => {
        expect(showRemoveSample()).toEqual({
            type: SHOW_REMOVE_SAMPLE
        });
    });

    it("hideSampleModal", () => {
        expect(hideSampleModal()).toEqual({
            type: HIDE_SAMPLE_MODAL
        });
    });
});
