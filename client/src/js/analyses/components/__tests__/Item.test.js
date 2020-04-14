jest.mock("../../../samples/selectors");

import { REMOVE_ANALYSIS } from "../../../app/actionTypes";
import { AnalysisItem, mapStateToProps, mapDispatchToProps } from "../Item";
import { getCanModify } from "../../../samples/selectors";

describe("<AnalysisItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            algorithm: "nuvs",
            canModify: true,
            created_at: "2018-02-14T17:12:00.000000Z",
            id: "baz",
            index: {
                version: 3
            },
            placeholder: false,
            ready: false,
            reference: {
                name: "Foo"
            },
            sampleId: "bar",
            subtraction: {
                id: "baz",
                name: "Prunus persica"
            },
            user: {
                id: "bob"
            },
            onRemove: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<AnalysisItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [placeholder=true]", () => {
        props.placeholder = true;
        const wrapper = shallow(<AnalysisItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [ready=false]", () => {
        props.ready = false;
        const wrapper = shallow(<AnalysisItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    const state = {
        samples: {
            detail: { id: "foo" }
        }
    };

    it.each([true, false])("should return props with [canModify=%p]", canModify => {
        getCanModify.mockReturnValue(canModify);
        const props = mapStateToProps(state);
        expect(getCanModify).toHaveBeenCalledWith(state);
        expect(props).toEqual({
            sampleId: "foo",
            canModify
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return onRemove() in props", () => {
        const id = "foo";
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch, { id });
        props.onRemove();
        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_ANALYSIS.REQUESTED,
            analysisId: id
        });
    });
});
