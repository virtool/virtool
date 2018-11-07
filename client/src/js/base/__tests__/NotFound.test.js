import { NotFound } from "../NotFound";

describe("<NotFound />", () => {
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<NotFound />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders optional alternate message and status", () => {
        wrapper = shallow(<NotFound status={409} message="Test" />);

        expect(
            wrapper
                .find("span")
                .children()
                .text()
        ).toEqual("409");
        expect(
            wrapper
                .find("strong")
                .children()
                .text()
        ).toEqual("Test");
        expect(wrapper).toMatchSnapshot();
    });
});
