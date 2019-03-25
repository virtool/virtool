import { UploadBar } from "../UploadBar";

describe("<UploadBar />", () => {
    it("should render", () => {
        const wrapper = shallow(<UploadBar />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render optional message", () => {
        const wrapper = shallow(<UploadBar message="Foobar" />);
        expect(wrapper).toMatchSnapshot();
    });
});
