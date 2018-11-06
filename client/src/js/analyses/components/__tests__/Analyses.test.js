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
        expect(props.onFindAnalyses).toBeCalledWith("foo");
        expect(props.onFindHmms).toBeCalled();
        expect(props.onListReadyIndexes).toBeCalled();
    });
});
