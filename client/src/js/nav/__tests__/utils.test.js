import { excludePaths } from "../utils";

describe("excludePaths()", () => {
    let func;
    let match;
    let location;

    beforeEach(() => {
        func = excludePaths(["/foo/files", "/foo/settings"]);
        match = "truthy";
        location = {
            pathname: "/foo/bar"
        };
    });

    it("should return a function that returns true by default", () => {
        func = excludePaths();
        const result = func(match, location);
        expect(result).toBe(true);
    });

    it("should return a function that returns true when location is not excluded and match is truthy", () => {
        const result = func(match, location);
        expect(result).toBe(true);
    });

    it("should return a function that returns false when not excluded and match is falsey", () => {
        match = 0;
        const result = func(match, location);
        expect(result).toBe(false);
    });

    it("should return a function that returns false when excluded", () => {
        location.pathname = "/foo/files";
        const result = func(match, location);
        expect(result).toBe(false);
    });
});
