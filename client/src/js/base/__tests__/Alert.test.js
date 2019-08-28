import { Alert } from "../Alert";

describe("<Alert />", () => {
    it("should render", () => {
        const wrapper = shallow(<Alert />);
        expect(wrapper).toMatchSnapshot();
    });
});
