import PathoscopeViewer from "../Viewer";

describe("<PathoscopeViewer />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<PathoscopeViewer />);
        expect(wrapper).toMatchSnapshot();
    });
});
