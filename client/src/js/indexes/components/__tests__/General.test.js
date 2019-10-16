import IndexGeneral  from "../General";

describe("<IndexGeneral />", () => {
    it("should render", () => {
        const wrapper = shallow(<IndexGeneral />);
        expect(wrapper).toMatchSnapshot();
    });
});
