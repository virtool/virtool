import IndexGeneral, { PanelBadgeHeader } from "../General";

describe("<IndexGeneral />", () => {
    it("should render", () => {
        const wrapper = shallow(<IndexGeneral />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<PanelBadgeHeader />", () => {
    it("should render with title 'Foo' and count of 23", () => {
        const wrapper = shallow(<PanelBadgeHeader title="Foo" count={23} />);
        expect(wrapper).toMatchSnapshot();
    });
});
