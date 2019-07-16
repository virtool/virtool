import PathoscopeViewer from "../Viewer";

describe("<PathoscopeViewer />", () => {
    it("should render", () => {
        const wrapper = shallow(<PathoscopeViewer />);
        expect(wrapper).toMatchSnapshot();
    });
});
