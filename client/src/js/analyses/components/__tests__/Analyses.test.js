import { Analyses } from "../Analyses";

describe("<Analyses />", () => {
    let props;

    beforeEach(() => {
        props = {
            sampleId: "foo",
            loading: false,
            onFindAnalyses: jest.fn(),
            onFindHmms: jest.fn(),
            onListReadyIndexes: jest.fn()
        };
    });

    it("should render sub-components when not loading", () => {
        const wrapper = shallow(<Analyses {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render placeholder when loading", () => {
        props.loading = true;
        const wrapper = shallow(<Analyses {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call API functions on mount", () => {
        shallow(<Analyses {...props} />);
        expect(props.onFindAnalyses).toHaveBeenCalledWith("foo");
        expect(props.onFindHmms).toHaveBeenCalled();
        expect(props.onListReadyIndexes).toHaveBeenCalled();
    });
});
