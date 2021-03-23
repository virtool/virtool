import { act, renderHook } from "@testing-library/react-hooks";
import { useExpanded, useSequenceData } from "../hooks";

describe("useSequenceData()", () => {
    it("should return empty strings by default", () => {
        const { result } = renderHook(() => useSequenceData({}));

        expect(result.current.data).toEqual({
            accession: "",
            definition: "",
            host: "",
            sequence: ""
        });
    });

    it("should take initial values", () => {
        const accession = "foo";
        const definition = "Foo";
        const host = "Host";
        const sequence = "ATGC";

        const { result } = renderHook(() => useSequenceData({ accession, definition, host, sequence }));

        expect(result.current.data).toEqual({
            accession,
            definition,
            host,
            sequence
        });
    });

    it("should be updated be updateData", () => {
        const accession = "foo";

        const { result } = renderHook(() => useSequenceData({ accession }));

        const { data, updateData } = result.current;

        expect(data).toEqual({
            accession,
            definition: "",
            host: "",
            sequence: ""
        });

        const definition = "Bar";
        const sequence = "ATGCGCCA";

        act(() => {
            updateData({ definition, sequence });
        });

        expect(result.current.data).toEqual({
            accession,
            definition,
            host: "",
            sequence
        });
    });
});

describe("useExpanded()", () => {
    it("should be collapsed (false) initially and expand and collapse", () => {
        const { result } = renderHook(() => useExpanded());

        expect(result.current.expanded).toBe(false);

        act(() => {
            result.current.expand();
        });

        expect(result.current.expanded).toBe(true);

        act(() => {
            result.current.collapse();
        });

        expect(result.current.expanded).toBe(false);
    });
});
