import { getDataTypeFromLibraryType } from "../utils";

describe("getDataTypeFromLibraryType()", () => {
    it("should return 'barcode' when libraryType is 'amplicon'", () => {
        const dataType = getDataTypeFromLibraryType("amplicon");
        expect(dataType).toBe("barcode");
    });

    it("should return 'genome' when libraryType is 'normal'", () => {
        const dataType = getDataTypeFromLibraryType("normal");
        expect(dataType).toBe("genome");
    });
});
