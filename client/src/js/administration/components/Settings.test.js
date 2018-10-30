import SettingsContainer, { Settings, Server } from "./Settings";

describe("<Settings />", () => {
    let wrapper;

    it("renders correctly", () => {
        const initialState = { settings: { data: {} } };
        const store = mockStore(initialState);
        wrapper = shallow(<SettingsContainer store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

    it("renders Settings subcomponent correctly", () => {
        wrapper = shallow(<Settings settings={null} />);
        expect(wrapper).toMatchSnapshot();

        wrapper = shallow(<Settings settings={{}} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders Server subcomponent correctly", () => {
        wrapper = shallow(<Server />);
        expect(wrapper).toMatchSnapshot();
    });
});
