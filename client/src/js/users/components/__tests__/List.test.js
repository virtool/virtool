import React from "react";
import { ThemeProvider } from "styled-components";
import { FIND_USERS } from "../../../app/actionTypes";
import { ScrollList } from "../../../base";
import { UsersList, mapStateToProps, mapDispatchToProps } from "../List";

const ThemeProviderWrapper = ({ children }) => {
    const theme = {
        color: {
            greyLight: "#dddddd"
        }
    };

    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

const mountWithTheme = tree =>
    mount(tree, {
        wrappingComponent: ThemeProviderWrapper
    });

describe("<UsersList />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [{ id: "fred" }],
            term: "foo",
            onLoadNextPage: jest.fn(),
            page: 2,
            page_count: 5
        };
    });

    it("should render", () => {
        const wrapper = shallow(<UsersList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [documents=null]", () => {
        props.documents = null;
        const wrapper = shallow(<UsersList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onLoadNextPage() on mount", () => {
        props.documents = null;
        mountWithTheme(<UsersList {...props} />);
        expect(props.onLoadNextPage).toHaveBeenCalledWith("foo", 1);
    });

    it("should call onLoadNextPage() when paged", () => {
        const wrapper = shallow(<UsersList {...props} />);
        wrapper.find(ScrollList).prop("onLoadNextPage")(8);
        expect(props.onLoadNextPage).toHaveBeenCalledWith("foo", 8);
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const users = {
            documents: [{ id: "bob" }],
            page: 2,
            page_count: 10,
            term: "foo"
        };
        const props = mapStateToProps({
            users
        });

        expect(props).toEqual(users);
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onLoadNextPage() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        const term = "foo";
        const page = 3;

        props.onLoadNextPage(term, page);

        expect(dispatch).toHaveBeenCalledWith({
            type: FIND_USERS.REQUESTED,
            term,
            page
        });
    });
});
