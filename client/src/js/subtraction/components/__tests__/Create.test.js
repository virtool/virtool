import { CreateSubtraction, SubtractionFileItem } from "../Create";

describe("<SubtractionFileItem />", () => {
    it.each([true, false])("should render when [active=%p]", active => {
        const props = {
            active,
            name: "test",
            uploaded_at: "2018-02-14T17:12:00.000000Z",
            user: { id: "test-user" }
        };
        const wrapper = shallow(<SubtractionFileItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<CreateSubtraction />", () => {
    it("should render", () => {
        const props = {
            show: true,
            files: [{ id: "test" }],
            error: "",
            onCreate: jest.fn(),
            onListFiles: jest.fn(),
            onHide: jest.fn(),
            onClearError: jest.fn()
        };
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
