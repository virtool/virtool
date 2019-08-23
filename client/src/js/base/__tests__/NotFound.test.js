import { NotFound } from "../NotFound";

describe("<NotFound />", () => {
    let wrapper;

    it("should render default", () => {
        wrapper = shallow(<NotFound />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with status", () => {
        const wrapper = shallow(<NotFound status={409} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with message", () => {
        wrapper = shallow(<NotFound message="Resource missing" />);
        expect(wrapper).toMatchSnapshot();
    });
});
