import { InputError } from "../InputError";
import { InputSave } from "../InputSave";
import { Input } from "../Input";

describe("<InputError />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<InputError />);

        expect(wrapper).toMatchSnapshot();
    });

    describe("error props supplied", () => {
        beforeEach(() => {
            props = {
                error: "Test Error Message"
            };
            wrapper = shallow(<InputError {...props} />);
        });

        it("[class='input-form-error']", () => {
            expect(
                wrapper
                    .find("div")
                    .at(1)
                    .hasClass("input-form-error")
            ).toBe(true);
        });

        it("shown message is error string", () => {
            expect(wrapper.find("span").text()).toEqual(props.error);
            expect(wrapper.find("div").at(1)).toMatchSnapshot();
        });
    });

    describe("error props not supplied", () => {
        beforeEach(() => {
            props = {
                error: undefined
            };
            wrapper = shallow(<InputError {...props} />);
        });

        it("[class='input-form-error-none']", () => {
            expect(
                wrapper
                    .find("div")
                    .at(1)
                    .hasClass("input-form-error-none")
            ).toBe(true);
        });

        it("hidden message is 'None'", () => {
            expect(wrapper.find("span").text()).toEqual("None");
            expect(wrapper.find("div").at(1)).toMatchSnapshot();
        });
    });

    it("noError props suppied, error message <div> is not rendered", () => {
        props = {
            noError: true
        };
        wrapper = shallow(<InputError {...props} />);

        expect(wrapper.find("div").length).toEqual(1);
        expect(wrapper).toMatchSnapshot();
    });

    it("noError props is not supplied, error message <div> rendered", () => {
        props = {
            noError: undefined
        };
        wrapper = shallow(<InputError {...props} />);

        expect(wrapper.find("div").length).toEqual(2);
        expect(
            wrapper
                .find("div")
                .at(1)
                .hasClass("input-form-error-none")
        ).toBe(true);
        expect(wrapper.find("div").at(1)).toMatchSnapshot();
    });

    it("withButton props supplied, renders <InputSave />", () => {
        props = {
            withButton: true,
            onSave: jest.fn()
        };
        wrapper = shallow(<InputError {...props} />);

        expect(wrapper.find(InputSave).length).toEqual(1);
        expect(wrapper.find(InputSave)).toMatchSnapshot();
    });

    it("withButton props is not supplied, renders <Input />", () => {
        props = {
            withButton: undefined
        };
        wrapper = shallow(<InputError {...props} />);

        expect(wrapper.find(Input).length).toEqual(1);
        expect(wrapper.find(Input)).toMatchSnapshot();
    });
});
