import SentryOptionsContainer, {
    SentryFooter,
    SentryOptions
} from "./Sentry";

describe("<Sentry />", () => {
    const initialState = { settings: { data: { enable_sentry: false } } };
    const store = mockStore(initialState);
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<SentryOptionsContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders SentryFooter correctly", () => {
        wrapper = shallow(<SentryFooter />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders SentryOptions correctly", () => {
        const props = {
            enabled: false,
            onToggle: jest.fn()
        };
        wrapper = shallow(<SentryOptions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

});
