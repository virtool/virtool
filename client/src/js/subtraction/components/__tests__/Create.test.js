import { CreateSubtraction, SubtractionFileItem } from "../Create";

describe("<CreateSubtraction />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            show: true,
            files: [{ id: "test" }],
            error: "",
            onCreate: jest.fn(),
            onListFiles: jest.fn(),
            onHide: jest.fn(),
            onClearError: jest.fn()
        };
        wrapper = shallow(<CreateSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <SubtractionFileItem /> subcomponent", () => {
        props = {
            active: true,
            name: "test",
            uploaded_at: "2018-02-14T17:12:00.000000Z",
            user: { id: "test-user" }
        };
        wrapper = shallow(<SubtractionFileItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
