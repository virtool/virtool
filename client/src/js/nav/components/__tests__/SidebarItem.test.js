import SidebarItem from "../SidebarItem";

describe("<SidebarItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            exclude: ["/foo/files", "/foo/settings"],
            icon: "fa-foo",
            link: "/foo/bar",
            title: "Foobar"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SidebarItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
