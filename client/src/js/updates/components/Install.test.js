import { SoftwareInstall } from "./Install";

describe("<SoftwareInstall />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            show: true,
            process: ["one", "two", "three"],
            releases: [{ name: "test", size: 1024 }],
            updating: false,
            onInstall: jest.fn(),
            onHide: jest.fn()
        };
        wrapper = shallow(<SoftwareInstall {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

});
