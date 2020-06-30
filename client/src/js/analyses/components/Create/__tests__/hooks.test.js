import { act, renderHook } from "@testing-library/react-hooks";
import { useCreateAnalysis } from "../hooks";

describe("useCreateAnalysis()", () => {
    let dataType = "genome";
    let defaultSubtraction = "baz";
    let rerender;
    let result;

    beforeEach(() => {
        const renderObj = renderHook(() => useCreateAnalysis(dataType, defaultSubtraction));

        result = renderObj.result;
        rerender = renderObj.rerender;
    });

    it("should set error", () => {
        expect(result.current.error).toBe("");

        act(() => {
            result.current.setError("Fake Error");
        });

        expect(result.current.error).toEqual("Fake Error");
    });

    it("should set subtraction", () => {
        expect(result.current.subtraction).toEqual(defaultSubtraction);

        act(() => {
            result.current.setSubtraction("foo");
        });

        expect(result.current.subtraction).toEqual("foo");
    });

    it("should toggle workflows", () => {
        act(() => {
            result.current.toggleWorkflow("foo");
        });

        expect(result.current.workflows).toEqual(["foo"]);

        act(() => {
            result.current.toggleWorkflow("foo");
        });

        expect(result.current.workflows).toEqual([]);
    });

    it("should toggle indexes and unset error", () => {
        act(() => {
            result.current.setError("Fake Error");
        });

        expect(result.current.error).toEqual("Fake Error");

        act(() => {
            result.current.toggleIndex("foo");
        });

        expect(result.current.indexes).toEqual(["foo"]);
        expect(result.current.error).toEqual("");

        act(() => {
            result.current.toggleIndex("foo");
        });
    });

    it("should empty indexes and workflows when dataType changes", () => {
        act(() => {
            result.current.toggleIndex("foo");
            result.current.toggleWorkflow("bar");
        });

        expect(result.current.indexes).toEqual(["foo"]);
        expect(result.current.workflows).toEqual(["bar"]);

        dataType = "barcode";
        rerender();

        expect(result.current.indexes).toEqual([]);
        expect(result.current.workflows).toEqual([]);
    });
});
