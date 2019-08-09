import App from "../App";

describe("<App />", () => {
    let store;
    let wrapper;

    it("renders correctly", () => {
        store = {
            subscribe: jest.fn(),
            dispatch: jest.fn(),
            getState: jest.fn()
        };
        wrapper = shallow(<App store={store} history={{}} />);
        expect(wrapper).toMatchSnapshot();
    });
});
