import Release, { ReleaseMarkdown } from "../Release";

describe("<Release />", () => {
    let props;
    let state;
    it("renders correctly", () => {
        props = {
            body: "foo bar baz",
            name: "test",
            html_url: "www.github.com/virtool/virtool"
        };
        const wrapper = shallow(<Release {...props} />);
    });

    it("should call handleClick when div is clicked", () => {
        state = {
            in: true
        };

        const wrapper = shallow(<Release {...props} />);
        wrapper
            .find("Box")
            .at(0)
            .simulate("click");
        expect(wrapper.state()).toEqual({ in: false });
    });

    it("renders <ReleaseMarkdown /> subcomponent", () => {
        props = { body: "hello world" };
        const wrapper = shallow(<ReleaseMarkdown {...props} />);
        wrapper.setProps({ noMargin: true });
        expect(wrapper).toMatchSnapshot();
    });
});
