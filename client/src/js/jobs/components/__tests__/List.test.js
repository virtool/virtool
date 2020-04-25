jest.mock("../../../utils/utils");

import { JobsList, mapStateToProps, mapDispatchToProps } from "../List";
import { checkAdminOrPermission } from "../../../utils/utils";

describe("<JobsList />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [{ foo: "bar" }],
            total_count: 5,
            page: 2,
            page_count: 3,
            term: "foo",
            onLoadNextPage: jest.fn(),
            canRemove: jest.fn(),
            canCancel: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<JobsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount should call onLoadNextPage", () => {
        expect(props.onLoadNextPage).not.toHaveBeenCalled();
        shallow(<JobsList {...props} />);
        expect(props.onLoadNextPage).toHaveBeenCalledWith("foo", 1);
    });

    it("should render when [this.props.documents=null]", () => {
        props.documents = null;
        const wrapper = shallow(<JobsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [this.props.documents.length=0]", () => {
        props.documents = [];
        const wrapper = shallow(<JobsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("checkAdminOrPermission should return state.account.permissions[permission]", () => {
        const state = {
            jobs: {
                term: "foo"
            },
            account: {
                administrator: false,
                permissions: {
                    cancel_job: "fee",
                    remove_job: "bee"
                }
            }
        };
        checkAdminOrPermission.mockReturnValue("bar");

        const result = mapStateToProps(state);
        expect(checkAdminOrPermission).toHaveBeenNthCalledWith(
            1,
            {
                jobs: {
                    term: "foo"
                },
                account: {
                    administrator: false,
                    permissions: {
                        cancel_job: "fee",
                        remove_job: "bee"
                    }
                }
            },
            "cancel_job"
        );
        expect(checkAdminOrPermission).toHaveBeenNthCalledWith(
            2,
            {
                jobs: {
                    term: "foo"
                },
                account: {
                    administrator: false,
                    permissions: {
                        cancel_job: "fee",
                        remove_job: "bee"
                    }
                }
            },
            "remove_job"
        );

        expect(result.canCancel).toEqual("bar");
        expect(result.canRemove).toEqual("bar");
    });
});

describe("mapDispatchToProps", () => {
    it("should return onLoadNextPage in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onLoadNextPage("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({ term: "foo", page: "bar", type: "FIND_JOBS_REQUESTED" });
    });
});
