import React from "react";
import "@testing-library/jest-dom/extend-expect";
import { SubtractionFiles, mapStateToProps } from "../Files";

describe("<SubtractionFiles />", () => {
    let props = {};

    beforeEach(() => {
        props.files = [
            {
                download_url: "/api/subtractions/xl8faqqz/files/subtraction.fa.gz",
                id: 1,
                name: "foo",
                size: 36461731,
                subtraction: "xl8faqqz",
                type: "fasta"
            },
            {
                download_url: "/api/subtractions/k66fpdyy/files/subtraction.3.bt2",
                id: 2,
                name: "bar",
                size: 3257,
                subtraction: "k66fpdyy",
                type: "bowtie2"
            }
        ];
    });
    it("should render NoneFound when no files are supplied", () => {
        props.files = [];
        const { getByText } = renderWithProviders(<SubtractionFiles {...props} />);

        expect(getByText("No subtraction files found")).toBeInTheDocument();
    });

    it("should render", () => {
        const { getByText } = renderWithProviders(<SubtractionFiles {...props} />);

        expect(getByText("Files")).toBeInTheDocument();
        expect(getByText("Data files available to workflows using this subtraction.")).toBeInTheDocument();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const detail = {
            files: [
                { id: 1, name: "File 1" },
                { id: 2, name: "File 2" }
            ]
        };
        const state = { subtraction: { detail } };
        const props = mapStateToProps(state);
        expect(props).toEqual(detail);
    });
});
