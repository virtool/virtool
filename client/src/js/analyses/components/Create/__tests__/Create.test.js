import React from "react";
import { map } from "lodash";
import { CreateAnalysis } from "../Create";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { Router } from "react-router-dom";
import { createBrowserHistory } from "history";
import { noop } from "lodash-es";

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

    // Include mapStateToProps
});
