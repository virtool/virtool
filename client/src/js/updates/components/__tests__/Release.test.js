import Release from "../Release";

describe("<Release />", () => {
    const props = { name: "foo", body: "bar", html_url: "baz" };

    it("should render", () => {
        const wrapper = shallow(<Release {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call handleClick when div is clicked", () => {
        const wrapper = shallow(<Release {...props} />);
        wrapper.find("Release__ReleaseName").simulate("click");

        expect(wrapper.state().in).toEqual(true);
    });
});
