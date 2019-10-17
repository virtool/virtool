import React from "react";
import { JobsToolbar, mapStateToProps, mapDispatchToProps } from "../Toolbar.js";
import { CLEAR_JOBS, FIND_JOBS } from "../../../app/actionTypes";

describe("<JobsToolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            onClear: jest.fn(),
            onFind: jest.fn(),
            canRemove: true,
            term: "foo"
        };
    });

    it("should render with dropdown menu", () => {
        const wrapper = shallow(<JobsToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without dropdown menu", () => {
        props.canRemove = false;
        const wrapper = shallow(<JobsToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should return props", () => {
        const state = {
            jobs: {
                term: "bar"
            },
            account: {
                administrator: true,
                permissions: true
            },
            canRemove: true
        };

        const props = mapStateToProps(state);
        expect(props).toEqual({
            term: "bar",
            canRemove: true
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return onFind() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        const e = {
            target: {
                value: "Foo"
            }
        };
        props.onFind(e, "foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({
            type: FIND_JOBS.REQUESTED,
            term: "Foo",
            page: 1
        });
    });

    it("should return onClear() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onClear("Foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: CLEAR_JOBS.REQUESTED,
            scope: "Foo"
        });
    });
});
