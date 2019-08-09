import { MemoryRouter } from "react-router";
import { Provider } from "react-redux";
import { Route } from "react-router-dom";
import { LoadingPlaceholder } from "../../base/index";
import App, { InnerContainer, Inner } from "../App";

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
