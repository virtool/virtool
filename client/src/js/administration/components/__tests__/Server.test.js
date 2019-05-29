import { ServerSettings } from "../Server";

describe("<ServerSettings />", () => {
    it("should render", () => {
        const wrapper = shallow(<ServerSettings />);
        expect(wrapper).toMatchSnapshot();
    });
});
