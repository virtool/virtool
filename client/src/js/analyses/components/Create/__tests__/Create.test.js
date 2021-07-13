import React from "react";
import { map } from "lodash";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { Router } from "react-router-dom";
import { createBrowserHistory } from "history";
import { noop } from "lodash-es";
import { CreateAnalysis, mapDispatchToProps, mapStateToProps } from "../Create";

describe("<CreateAnalysis />", () => {
    let props;
    const errorMessages = ["Workflow(s) must be selected", "Reference(s) must be selected"];
    const preloadedState = { hmm: { status: { installed: null } } };

    const renderWithStore = component =>
        renderWithProviders(
            <Provider store={configureStore({ reducer: noop, preloadedState })}>
                <Router history={createBrowserHistory()}>{component}</Router>
            </Provider>
        );

    beforeEach(() => {
        props = {
            accountId: 1,
            compatibleIndexes: [
                {
                    id: "foo",
                    version: 0,
                    reference: {
                        id: "bar",
                        name: "Plant Viruses",
                        data_type: "genome"
                    }
                }
            ],
            dataType: "genome",
            defaultSubtraction: [],
            hasHmm: false,
            sampleId: 0,
            show: true,
            subtractions: [
                { id: "foo", name: "Foo" },
                { id: "bar", name: "Bar" }
            ],
            value: ["foo"],
            onAnalyze: jest.fn(),
            onHide: jest.fn(),
            onShortlistSubtractions: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CreateAnalysis {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should show errors when required fields aren't selected", () => {
        renderWithStore(<CreateAnalysis {...props} />);
        // Ensure that no error messages appear until the Start button has clicked
        map(errorMessages, error => expect(screen.queryByText(error)).not.toBeInTheDocument());
        userEvent.click(screen.getByTestId("Start"));
        expect(props.onAnalyze).not.toHaveBeenCalled();
        map(errorMessages, error => expect(screen.queryByText(error)).toBeInTheDocument());
    });

    it("should submit with expected values", () => {
        renderWithStore(<CreateAnalysis {...props} />);
        userEvent.click(screen.getByText("Pathoscope"));
        userEvent.click(screen.getByText(props.subtractions[0].name));
        userEvent.click(screen.getByText(props.compatibleIndexes[0].reference.name));
        userEvent.click(screen.getByTestId("Start"));

        expect(props.onAnalyze).toHaveBeenCalledWith(
            props.sampleId,
            [props.compatibleIndexes[0].reference.id],
            [props.subtractions[0].id],
            props.accountId,
            ["pathoscope_bowtie"]
        );
    });

    it("should automatically select default subtractions", () => {
        // Set the default subtraction to the list of subtraction's ids
        props.defaultSubtraction = props.subtractions.map(subtraction => subtraction.id);

        renderWithStore(<CreateAnalysis {...props} />);
        userEvent.click(screen.getByText("Pathoscope"));
        userEvent.click(screen.getByText(props.compatibleIndexes[0].reference.name));
        userEvent.click(screen.getByTestId("Start"));

        expect(props.onAnalyze).toHaveBeenCalledWith(
            props.sampleId,
            [props.compatibleIndexes[0].reference.id],
            props.defaultSubtraction,
            props.accountId,
            ["pathoscope_bowtie"]
        );
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            account: { id: 0 },
            samples: { detail: { library_type: "normal", subtractions: [], id: "foo" } },
            analyses: { readyIndexes: [{ id: 0, reference: { id: 0, data_type: "genome", name: "name" } }] },
            hmms: { total_count: 0 },
            router: { location: { state: undefined } },
            subtraction: { shortlist: null }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            accountId: 0,
            compatibleIndexes: [{ id: 0, reference: { data_type: "genome", id: 0, name: "name" } }],
            dataType: "genome",
            defaultSubtraction: [],
            hasHmm: false,
            sampleId: "foo",
            show: false,
            subtractions: null
        });
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onAnalyze() in props", () => {
        props.onAnalyze();
        expect(dispatch).not.toHaveBeenCalled();

        const references = [{ id: "bar", name: "Plant Viruses", data_type: "genome" }];
        const sampleId = 0;
        const userId = 0;
        const workflows = ["workflow"];
        const subtractionIds = [];

        props.onAnalyze(sampleId, references, subtractionIds, userId, workflows);
        expect(dispatch).toHaveBeenCalledWith({
            type: "ANALYZE.REQUESTED",
            refId: references[0],
            sampleId,
            subtractionIds,
            type: "ANALYZE_REQUESTED",
            userId,
            workflow: workflows[0]
        });
    });

    it("should return onHide() in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({ state: {}, type: "PUSH_STATE" });
    });

    it("should return onShortlistSubtractions() in props", () => {
        props.onShortlistSubtractions();
        expect(dispatch).toHaveBeenCalledWith({
            type: "LIST_SUBTRACTION_IDS_REQUESTED"
        });
    });
});
