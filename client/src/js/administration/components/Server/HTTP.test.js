import HTTPOptionsContainer, {
    HTTPOptions,
    HTTPFooter,
    HTTPCheckboxLabel
} from "./HTTP";

describe("<HTTPOptions />", () => {
    const initialState = {
        settings: {
            data: {
                server_host: "foo",
                server_port: "1",
                enable_api: true
            }
        }
    };
    const store = mockStore(initialState);
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<HTTPOptionsContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders HTTPCheckboxLabel correctly", () => {
        wrapper = shallow(<HTTPCheckboxLabel />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders HTTPFooter correctly", () => {
        wrapper = shallow(<HTTPFooter />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders HTTPOptions correctly", () => {
        const props = {
            onUpdateHost: jest.fn(),
            onUpdatePort: jest.fn(),
            onUpdateAPI: jest.fn(),
            host: "foo",
            port: "1",
            enableApi: false
        };
        wrapper = shallow(<HTTPOptions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

});
