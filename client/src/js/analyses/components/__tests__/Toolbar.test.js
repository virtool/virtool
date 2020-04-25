jest.mock("../../../samples/selectors");

import { FIND_ANALYSES, PUSH_STATE } from "../../../app/actionTypes";
import { Button, SearchInput } from "../../../base";
import { getCanModify } from "../../../samples/selectors";
import { AnalysesToolbar, mapDispatchToProps, mapStateToProps } from "../Toolbar";

describe("<AnalysesToolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModify: true,
            page: 2,
            sampleId: "foobar",
            term: "baz",
            onFind: jest.fn(),
            onShowCreate: jest.fn()
        };
    });

    it("should render with default props", () => {
        const wrapper = shallow(<AnalysesToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [canModify=false]", () => {
        props.canModify = false;
        const wrapper = shallow(<AnalysesToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange", () => {
        const wrapper = shallow(<AnalysesToolbar {...props} />);
        const event = {
            target: {
                value: "hello"
            }
        };
        wrapper.find(SearchInput).simulate("change", event);
        expect(props.onFind).toHaveBeenCalledWith(props.sampleId, "hello", props.page);
    });

    it("should call onShowCreate", () => {
        const wrapper = shallow(<AnalysesToolbar {...props} />);
        wrapper.find(Button).simulate("click");
        expect(props.onShowCreate).toHaveBeenCalledWith(props.sampleId);
    });
});

describe("mapStateToProps", () => {
    let state;
    let expected;

    beforeEach(() => {
        state = {
            analyses: {
                page: 2,
                term: "baz"
            },
            samples: {
                detail: {
                    id: "foo"
                }
            }
        };
        expected = {
            canModify: true,
            page: 2,
            sampleId: "foo",
            term: "baz"
        };
    });

    it("should return props when [canModify=true]", () => {
        getCanModify.mockReturnValue(true);
        const result = mapStateToProps(state);
        expect(result).toEqual(expected);
    });

    it("should return props when [canModify=false]", () => {
        getCanModify.mockReturnValue(false);
        const result = mapStateToProps(state);
        expected.canModify = false;
        expect(result).toEqual(expected);
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onShowCreate in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        // Call onShowCreate.
        props.onShowCreate("foobar");
        expect(dispatch).toHaveBeenCalledWith({
            type: PUSH_STATE,
            state: {
                createAnalysis: ["foobar"]
            }
        });
    });

    it("should return onFind in props", () => {
        // Call onFind.
        const sampleId = "foobar";
        const term = "baz";
        const page = 3;

        props.onFind(sampleId, term, page);
        expect(dispatch).toHaveBeenCalledWith({
            type: FIND_ANALYSES.REQUESTED,
            sampleId,
            term,
            page
        });
    });
});
