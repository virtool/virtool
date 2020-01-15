import { Analyses } from "../Analyses";

describe("<Analyses />", () => {
    let props;

    beforeEach(() => {
        props = {
            sampleId: "foo",
            loading: false,
            onFindAnalyses: jest.fn(),
            onClearAnalyses: jest.fn(),
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

    it("should call dispatch functions on mount", () => {
        shallow(<Analyses {...props} />);
        expect(props.onFindAnalyses).toHaveBeenCalledWith("foo");
        expect(props.onFindHmms).toHaveBeenCalled();
        expect(props.onListReadyIndexes).toHaveBeenCalled();
    });

    it("should call onClearAnalyses() on unmount", () => {
        const wrapper = shallow(<Analyses {...props} />);
        expect(props.onClearAnalyses).not.toHaveBeenCalled();
        wrapper.unmount();
        expect(props.onClearAnalyses).toHaveBeenCalled();
    });
});
