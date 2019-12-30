import { HMMDetail, mapStateToProps, mapDispatchToProps } from "../Detail";

describe("<HMMDetail />", () => {
    let props;
    beforeEach(() => {
        props = {
            onGet: jest.fn(),
            error: false,
            detail: {
                names: ["foo"],
                cluster: "bar",
                mean_entropy: "baz",
                total_entropy: "boo",
                entries: ["Foo"],
                families: "Bar",
                genera: "Baz"
            },
            match: {
                params: {
                    hmmId: "bar"
                }
            }
        };
    });
    it("should render", () => {
        const wrapper = shallow(<HMMDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should return NotFound when [ props.error=true]", () => {
        props.error = true;
        const wrapper = shallow(<HMMDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should return LoadingPlaceholder when [ props.detail=null]", () => {
        props.detail = null;
        const wrapper = shallow(<HMMDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("componentDidMount() should call onGet", () => {
        shallow(<HMMDetail {...props} />);
        expect(props.onGet).toHaveBeenCalledWith("bar");
    });
});

describe("mapStateToProps()", () => {
    const state = {
        errors: {
            GET_HMM_ERROR: true
        },
        hmms: {
            detail: "foo"
        }
    };
    it("mapStateToProps() should return props", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual({
            error: true,
            detail: "foo"
        });
    });
});

describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();

    it("mapDispatchToProps() should return onGet() in props", () => {
        const props = mapDispatchToProps(dispatch);
        props.onGet("foo");
        expect(dispatch).toHaveBeenCalledWith({ hmmId: "foo", type: "GET_HMM_REQUESTED" });
    });
});
