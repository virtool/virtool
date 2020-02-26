import {
    SET_ANALYSIS_SORT_KEY,
    TOGGLE_ANALYSIS_SORT_DESCENDING,
    TOGGLE_FILTER_ISOLATES,
    TOGGLE_FILTER_OTUS
} from "../../../../app/actionTypes";
import { mapDispatchToProps, mapStateToProps, PathoscopeDownloadDropdownTitle, PathoscopeToolbar } from "../Toolbar";
import { getFuse } from "../../../selectors";

jest.mock("../../../selectors");

describe("<PathoscopeDownloadDropdownTitle />", () => {
    it("should render", () => {
        const wrapper = shallow(<PathoscopeDownloadDropdownTitle />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<Toolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            analysisId: "foo",
            filterIsolates: true,
            filterOTUs: true,
            showReads: false,
            sortDescending: true,
            sortKey: "coverage",
            onCollapse: jest.fn(),
            onToggleFilterOTUs: jest.fn(),
            onToggleFilterIsolates: jest.fn(),
            onSetSortKey: jest.fn(),
            onToggleSortDescending: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [filterIsolates=false]", () => {
        props.filterIsolates = false;
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [filterOTUs=false]", () => {
        props.filterOTUs = false;
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [sortDescending=false]", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each(["weight", "depth"])("should render when [sortKey=%p]", sortKey => {
        props.sortKey = sortKey;
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onToggleSortDescending() when corresponding button clicked", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onToggleSortDescending).not.toHaveBeenCalled();
        wrapper
            .find("Button")
            .at(0)
            .simulate("click");
        expect(props.onToggleSortDescending).toHaveBeenCalled();
    });

    it("should call onToggleFilterOTUs() when filter selected", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onToggleFilterIsolates).not.toHaveBeenCalled();
        wrapper
            .find("Button")
            .at(1)
            .simulate("click");
        expect(props.onToggleFilterOTUs).toHaveBeenCalled();
    });

    it("should call onFilterIsolates() when filter isolates button clicked", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onToggleFilterIsolates).not.toHaveBeenCalled();
        wrapper
            .find("Button")
            .at(2)
            .simulate("click");
        expect(props.onToggleFilterIsolates).toHaveBeenCalled();
    });

    it("should call onSetSortKey() when sort key selected", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        const e = {
            target: {
                value: "pi"
            }
        };
        expect(props.onSetSortKey).not.toHaveBeenCalled();
        wrapper
            .find("FormControl")
            .at(1)
            .simulate("change", e);
        expect(props.onSetSortKey).toHaveBeenCalledWith("pi");
    });
});

describe("mapStateToProps()", () => {
    getFuse.mockReturnValue("fuse");

    it("should return props", () => {
        const state = {
            analyses: {
                detail: {
                    id: "foo"
                },
                filterIsolates: false,
                filterOTUs: false,
                sortDescending: false,
                sortKey: "pi"
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            analysisId: "foo",
            filterIsolates: false,
            filterOTUs: false,
            fuse: "fuse",
            sortDescending: false,
            sortKey: "pi"
        });
        expect(getFuse).toHaveBeenCalledWith(state);
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onToggleFilterOTUs() in props", () => {
        props.onToggleFilterOTUs();
        expect(dispatch).toHaveBeenCalledWith({
            type: TOGGLE_FILTER_OTUS
        });
    });

    it("should return onToggleFilterIsolates() in props", () => {
        props.onToggleFilterIsolates();
        expect(dispatch).toHaveBeenCalledWith({
            type: TOGGLE_FILTER_ISOLATES
        });
    });

    it("should return onSetSortKey() in props", () => {
        props.onSetSortKey("foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_ANALYSIS_SORT_KEY,
            sortKey: "foo"
        });
    });

    it("should return onToggleSortDescending() in props", () => {
        props.onToggleSortDescending();
        expect(dispatch).toHaveBeenCalledWith({
            type: TOGGLE_ANALYSIS_SORT_DESCENDING
        });
    });
});
