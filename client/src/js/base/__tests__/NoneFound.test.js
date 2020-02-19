import { NoneFound, NoneFoundBox, NoneFoundSection } from "../NoneFound";

describe("<NoneFound />", () => {
    it("should render with [noun='files'", () => {
        const wrapper = shallow(<NoneFound noun="files" />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<NoneFoundBox />", () => {
    it("should render with [noun='boxes'", () => {
        const wrapper = shallow(<NoneFoundBox noun="boxes" />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<NoneFoundSection />", () => {
    it("should render with [noun='sections'", () => {
        const wrapper = shallow(<NoneFoundSection noun="sections" />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [noun='sections'] and children", () => {
        const wrapper = shallow(
            <NoneFoundSection noun="sections">
                <span>foo</span>
            </NoneFoundSection>
        );
        expect(wrapper).toMatchSnapshot();
    });
});
