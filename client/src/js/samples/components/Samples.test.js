import Samples, { SampleFileManager, SampleSettings } from "./Samples";

describe("<Samples />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctly when settings data available", () => {
        initialState = { settings: { data: { foo: false, bar: true } } };
        store = mockStore(initialState);

        wrapper = shallow(<Samples store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <LoadingPlaceholder /> when settings data not available", () => {
        initialState = { settings: { data: null } };
        store = mockStore(initialState);

        wrapper = shallow(<Samples store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <SamplesSettings />", () => {
        wrapper = shallow(<SampleSettings />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <SampleFileManager />", () => {
        wrapper = shallow(<SampleFileManager />);
        expect(wrapper).toMatchSnapshot();
    });
});
