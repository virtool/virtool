import { SoftwareInstall } from "../Install";

describe("<SoftwareInstall />", () => {
    it("should render", () => {
        const props = {
            show: true,
            task: ["one", "two", "three"],
            releases: [{ name: "test", size: 1024 }],
            updating: false,
            onInstall: jest.fn(),
            onHide: jest.fn()
        };
        const wrapper = shallow(<SoftwareInstall {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
