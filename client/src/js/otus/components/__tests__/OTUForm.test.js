import OTUForm from "../OTUForm";

describe("<OTUForm />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            handleSubmit: jest.fn(),
            handleChange: jest.fn(),
            name: "test",
            abbreviation: "T",
            errorName: "",
            errorAbbreviation: ""
        };
        wrapper = shallow(<OTUForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
