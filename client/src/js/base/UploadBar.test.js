import Dropzone from "react-dropzone";
import { UploadBar } from "./UploadBar";
import { Button } from "./Button";

describe("<UploadBar />", () => {
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<UploadBar />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders optional message instead", () => {
        wrapper = shallow(<UploadBar message="tester" />);

        expect(
            wrapper
                .find(Dropzone)
                .children()
                .text()
        ).toEqual("tester");
        expect(wrapper).toMatchSnapshot();
    });

    it("calls Dropzone.open() on button click", () => {
        const spy = sinon.spy(Dropzone.prototype, "open");
        wrapper = mount(<UploadBar />);

        expect(spy.called).toBe(false);

        wrapper.find(Button).simulate("click");

        expect(spy.calledOnce).toBe(true);

        spy.restore();
    });
});
