import React from "react";
import { CLEAR_JOBS, FIND_JOBS } from "../../../app/actionTypes";
import { checkAdminOrPermission } from "../../../utils/utils";
import { JobsToolbar, mapDispatchToProps, mapStateToProps } from "../Toolbar.js";

jest.mock("../../../utils/utils");

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

    it("should render when [canRemove=true]", () => {
        const wrapper = shallow(<JobsToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [canRemove=false]", () => {
        props.canRemove = false;
        const wrapper = shallow(<JobsToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it.each([true, false])("should return props with [canRemove=%p]", canRemove => {
        checkAdminOrPermission.mockReturnValue(canRemove);
        const state = {
            jobs: {
                term: "bar"
            },
            account: {
                administrator: true,
                permissions: true
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            term: "bar",
            canRemove
        });
        expect(checkAdminOrPermission).toHaveBeenCalledWith(state, "remove_job");
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
