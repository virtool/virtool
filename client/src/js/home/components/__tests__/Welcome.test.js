import { Welcome } from "../Welcome";

describe("<Welcome />", () => {
    it("should render", () => {
        window.virtool = {
            version: "v1.2.3"
        };
        const wrapper = shallow(<Welcome version="v1.2.3" />);
        expect(wrapper).toMatchSnapshot();
    });
});
