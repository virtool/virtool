import React from "react";
import { map } from "lodash";
import { CreateAnalysis } from "../Create";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { Router } from "react-router-dom";
import { createBrowserHistory } from "history";

describe("<CreateAnalysis />", () => {
    let props;
    const errorMessages = ["Workflow(s) must be selected", "Reference(s) must be selected"];

    const reducer = value => console.log("Reducer was called with: ", value);

    const preloadedState = { hmm: { status: { installed: null } } };

    beforeEach(() => {
        props = {
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
        renderWithProviders(
            <Provider store={configureStore({ reducer, preloadedState })}>
                <Router history={createBrowserHistory()}>
                    <CreateAnalysis {...props} />
                </Router>
            </Provider>
        );
        // Ensure that the error messages do not appear until the Start button has clicked
        map(errorMessages, error => expect(screen.queryByText(error)).not.toBeInTheDocument());
        userEvent.click(screen.getByTestId("Start"));
        expect(props.onAnalyze).not.toHaveBeenCalled();
        map(errorMessages, error => expect(screen.queryByText(error)).toBeInTheDocument());
    });

    // it("should submit with expected values", () => {
    //     renderWithProviders(<CreateAnalysis {...props} />);
    // });

    // Include mapStateToProps
});
