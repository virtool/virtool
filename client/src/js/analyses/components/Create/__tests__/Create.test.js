import { CreateAnalysis } from "../Create";

describe("<CreateAnalysis />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [
                { id: "foo", name: "foo" },
                { id: "bar", name: "Bar" }
            ],
            indexes: [
                {
                    id: "ref1",
                    version: 3,
                    reference: {
                        id: "fer1",
                        name: "Ref1"
                    }
                },
                {
                    id: "ref2",
                    version: 1,
                    reference: {
                        id: "fer2",
                        name: "Ref2"
                    }
                }
            ],
            libraryType: "normal",
            userId: "bob",
            onAnalyze: jest.fn(),
            onHide: jest.fn(),
            onShortlistSubtractions: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CreateAnalysis {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with index selected", () => {
        const wrapper = shallow(<CreateAnalysis {...props} />);
        wrapper.setState({ selected: [{ id: "ref1", refId: "fer1" }] });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with algorithm selected", () => {
        const wrapper = shallow(<CreateAnalysis {...props} />);
        wrapper.setState({ algorithm: "nuvs" });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with summary", () => {
        const wrapper = shallow(<CreateAnalysis {...props} />);
        wrapper.setState({ algorithm: "nuvs", selected: [{ id: "ref1", refId: "fer1" }] });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        const wrapper = shallow(<CreateAnalysis {...props} />);
        wrapper.setState({ error: "Please select reference(s)" });
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onListSubtractionIds on mount", () => {
        expect(props.onShortlistSubtractions).not.toHaveBeenCalled();
        shallow(<CreateAnalysis {...props} />);
        expect(props.onShortlistSubtractions).toHaveBeenCalled();
    });
});
