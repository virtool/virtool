import { UploadItem } from "../UploadItem";

describe("<UploadItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            name: "Foo.fa",
            progress: 0
        };
    });

    it("should render when [progress === 0]", () => {
        const wrapper = shallow(<UploadItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [progress > 0]", () => {
        props.progress = 51;
        const wrapper = shallow(<UploadItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
