import { IndexItemChangeDescription, IndexItem, IndexItemIcon, mapStateToProps } from "../Item";
import { getActiveIndexId } from "../../selectors";

jest.mock("../../selectors");

describe("<IndexItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            refId: "foo",
            document: {
                id: "bar",
                ready: true,
                created_at: "2018-02-14T17:12:00.000000Z",
                version: 0,
                change_count: 3,
                modified_otu_count: 5
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<IndexItemChangeDescription />", () => {
    let props;

    beforeEach(() => {
        props = {
            changeCount: 13,
            modifiedCount: 3
        };
    });

    it("should render empty when changeCount is null", () => {
        props.changeCount = null;
        const wrapper = shallow(<IndexItemChangeDescription {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render 'No Changes' when changeCount is 0", () => {
        props.changeCount = 0;
        const wrapper = shallow(<IndexItemChangeDescription {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render valid description when modifiedCount is 1", () => {
        props.modifiedCount = 1;
        const wrapper = shallow(<IndexItemChangeDescription {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render valid description when changeCount is 1", () => {
        props.changeCount = 1;
        const wrapper = shallow(<IndexItemChangeDescription {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render valid description when changeCount is 13", () => {
        const wrapper = shallow(<IndexItemChangeDescription {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<IndexItemIcon />", () => {
    let props;

    beforeEach(() => {
        props = {
            activeId: "foo",
            id: "foo",
            ready: true
        };
    });

    it("should render checkmark when active", () => {
        const wrapper = shallow(<IndexItemIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render spinner when not ready", () => {
        props.ready = false;
        const wrapper = shallow(<IndexItemIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render nothing when ready, but not active", () => {
        props.activeId = "bar";
        const wrapper = shallow(<IndexItemIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props given state and ownProps", () => {
        getActiveIndexId.mockReturnValue("bar");

        const state = {
            indexes: {
                documents: [{ id: "foo" }, { id: "bar" }]
            },
            references: {
                detail: { id: "baz" }
            }
        };

        const ownProps = {
            index: 1
        };

        const result = mapStateToProps(state, ownProps);

        expect(result).toEqual({
            activeId: "bar",
            document: { id: "bar" },
            refId: "baz"
        });

        expect(getActiveIndexId).toHaveBeenCalledWith(state);
    });
});
