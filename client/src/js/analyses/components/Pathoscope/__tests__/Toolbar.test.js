import {
    COLLAPSE_ANALYSIS,
    SET_ANALYSIS_SORT_KEY,
    SET_PATHOSCOPE_FILTER,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    TOGGLE_SORT_PATHOSCOPE_DESCENDING
} from "../../../../app/actionTypes";
import { PathoscopeDownloadDropdownTitle, PathoscopeToolbar, mapDispatchToProps, mapStateToProps } from "../Toolbar";

describe("<PathoscopeDownloadDropdownTitle />", () => {
    const wrapper = shallow(<PathoscopeDownloadDropdownTitle />);
    expect(wrapper).toMatchSnapshot();
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
            onFilter: jest.fn(),
            onSetSortKey: jest.fn(),
            onToggleShowReads: jest.fn(),
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

    it("should render when [filterOTUs=false] and [filterIsolates=false]", () => {
        props.filterOTUs = false;
        props.filterIsolates = false;
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [showReads=true]", () => {
        props.filterOTUs = false;
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [sortDescending=false]", () => {
        props.filterOTUs = false;
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [sortKey='weight']", () => {
        props.sortKey = "weight";
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onCollapse() when corresponding button clicked", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onCollapse).not.toHaveBeenCalled();
        wrapper
            .find("Button")
            .at(1)
            .simulate("click");
        expect(props.onCollapse).toHaveBeenCalled();
    });

    it("should call onFilter() when filter selected", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onFilter).not.toHaveBeenCalled();
        wrapper
            .find("#pathoscope-filter-dropdown")
            .props()
            .onSelect("OTUs");
        expect(props.onFilter).toHaveBeenCalledWith("OTUs");
    });

    it("should call onFilter() when filter button clicked", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onFilter).not.toHaveBeenCalled();
        wrapper
            .find("Button")
            .at(3)
            .simulate("click");
        expect(props.onFilter).toHaveBeenCalledWith();
    });

    it("should call onSetSortKey() when sort key selected", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        const e = {
            target: {
                value: "pi"
            }
        };
        expect(props.onSetSortKey).not.toHaveBeenCalled();
        wrapper.find("FormControl").simulate("change", e);
        expect(props.onSetSortKey).toHaveBeenCalledWith("pi");
    });

    it("should call onToggleShowReads() when corresponding button clicked", () => {
        const wrapper = shallow(<PathoscopeToolbar {...props} />);
        expect(props.onToggleShowReads).not.toHaveBeenCalled();
        wrapper
            .find("Button")
            .at(2)
            .simulate("click");
        expect(props.onToggleShowReads).toHaveBeenCalled();
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
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            analyses: {
                detail: {
                    id: "foo"
                },
                filterIsolates: false,
                filterOTUs: false,
                showReads: false,
                sortDescending: false,
                sortKey: "pi"
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            analysisId: "foo",
            filterIsolates: false,
            filterOTUs: false,
            showReads: false,
            sortDescending: false,
            sortKey: "pi"
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

    it("should return onCollapse() in props", () => {
        props.onCollapse();
        expect(dispatch).toHaveBeenCalledWith({
            type: COLLAPSE_ANALYSIS
        });
    });

    it.each(["OTUs", "isolates"])("should return onFilter() in props that works when [key=%p]", key => {
        props.onFilter(key);
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_PATHOSCOPE_FILTER,
            key
        });
    });

    it("should return onFilter() in props that works with non-specific key", () => {
        props.onFilter("foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_PATHOSCOPE_FILTER,
            key: ""
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
            type: TOGGLE_SORT_PATHOSCOPE_DESCENDING
        });
    });

    it("should return onToggleShowReads() in props", () => {
        props.onToggleShowReads();
        expect(dispatch).toHaveBeenCalledWith({
            type: TOGGLE_SHOW_PATHOSCOPE_READS
        });
    });
});
