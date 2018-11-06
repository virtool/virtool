import { CreateAnalysis } from "../Create";

describe("<CreateAnalysis />", () => {
    let props;
    let wrapper;

    beforeEach(() => {
        props = {
            show: true,
            samples: null,
            id: "123abc",
            hasHmm: false,
            refIndexes: [],
            selected: [],
            userId: "test-user",
            onSubmit: jest.fn(),
            onHide: jest.fn(),
            onAnalyze: jest.fn()
        };
    });

    it("renders correctly", () => {
        wrapper = shallow(<CreateAnalysis {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setState({ selected: [{ id: "test1" }, { id: "test2" }] });
        expect(wrapper.find({ style: { float: "left" } })).toMatchSnapshot();

        wrapper.setProps({ samples: ["test", "example"] });
        expect(wrapper.find({ style: { float: "left" } })).toMatchSnapshot();

        wrapper.setProps({ samples: ["test"] });
        wrapper.setState({ selected: [{ id: "test" }] });
        expect(wrapper.find({ style: { float: "left" } })).toMatchSnapshot();
    });
});
