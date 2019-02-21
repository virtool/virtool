import { excludePaths, isHomeActive } from "../utils";

describe("excludePaths: the function returned", () => {
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

    it("should return true by default", () => {
        func = excludePaths();
        const result = func(match, location);
        expect(result).toBe(true);
    });

    it("should return true when not excluded and match is truthy", () => {
        const result = func(match, location);
        expect(result).toBe(true);
    });

    it("should return false when not excluded and match is falsey", () => {
        match = 0;
        const result = func(match, location);
        expect(result).toBe(false);
    });

    it("should return false when excluded", () => {
        location.pathname = "/foo/files";
        const result = func(match, location);
        expect(result).toBe(false);
    });
});

describe("isHomeActive", () => {
    const match = "";

    let location;

    beforeEach(() => {
        location = {
            pathname: "/"
        };
    });

    it("should return true when [location.pathname=/]", () => {
        const result = isHomeActive(match, location);
        expect(result).toBe(true);
    });

    it("should return true when [location.pathname=/home]", () => {
        location.pathname = "/home";
        const result = isHomeActive(match, location);
        expect(result).toBe(true);
    });

    it("should return false otherwise", () => {
        location.pathname = "/refs/foo";
        const result = isHomeActive(match, location);
        expect(result).toBe(false);
    });
});
