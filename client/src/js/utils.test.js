import * as utils from "./utils";

describe("Utility constants and functions module", () => {
    let result;
    let expected;

    it("byteSize(): converts number into closest whole units of B, KB, MB, GB ...", () => {
        let bytes = 1;
        result = utils.byteSize(bytes);
        expected = "1.0 B";
        expect(result).toEqual(expected);

        bytes = 1024;
        result = utils.byteSize(bytes);
        expected = "1.0 KB";
        expect(result).toEqual(expected);

        bytes = NaN;
        result = utils.byteSize(bytes);
        expected = "0.0 B"
        expect(result).toEqual(expected);

        bytes = 0;
        result = utils.byteSize(bytes);
        expected = "0.0 B";
        expect(result).toEqual(expected);

        bytes = null;
        result = utils.byteSize(bytes);
        expected = "0.0 B";
        expect(result).toEqual(expected);

        bytes = Infinity;
        result = utils.byteSize(bytes);
        expected = "NaN ";
        expect(result).toEqual(expected);

        // Unexpected/Undocumented behavior for numeral.js
        bytes = -1024;
        result = utils.byteSize(bytes);
        expected = "-1.0 KB";
        expect(result).not.toEqual(expected);
        const actual = "-1024.0 ";
        expect(result).toEqual(actual);
    });

    it("createFindURL()", () => {

        // 
    });

    it("createRandomString()", () => {
        result = utils.createRandomString();
        expect(result.length).toEqual(8);

        result = utils.createRandomString(20);
        expect(result.length).toEqual(20);
    });

    it("followDownload()", () => {
        //
    });

    it("followDynamicDownload()", () => {
        //
    });

    it("formatIsolateName()", () => {
        let isolate = {
            id: "testid",
            sequences: [],
            source_name: "ABCD",
            source_type: "isolate"
        };
        result = utils.formatIsolateName(isolate);
        expected = "Isolate ABCD";
        expect(result).toEqual(expected);

        isolate = {
            souce_name: "EFGH",
            source_type: "unknown"
        };
        result = utils.formatIsolateName(isolate);
        expected = "Unnamed";
        expect(result).toEqual(expected);
    });

    it("getFindTerm()", () => {
        //
    });

    it("getTaskDisplayName()", () => {
        let taskName = "";
    });

    it("reportAPIError()", () => {

    });

    it("routerLocationHasState()", () => {

    });

    it("simpleActionCreator()", () => {

    });

    it("toScientificNotation()", () => {

    });

});
