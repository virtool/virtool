import { MemoryRouter } from "react-router-dom";
import { OTUToolbar } from "../Toolbar";

describe("<OTUToolbar />", () => {
    let props = {
        canModify: true,
        page: 2,
        term: "foo",
        refId: "baz",
        verified: false
    };

    it("renders correctly", () => {
        const wrapper = shallow(<OTUToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    describe("onFind is called", () => {
        let onFind;
        let wrapper;

        beforeEach(() => {
            onFind = jest.fn();
            wrapper = mount(
                <MemoryRouter>
                    <OTUToolbar {...props} onFind={onFind} />
                </MemoryRouter>
            );
        });

        it("when the input field changes", () => {
            wrapper.find("input").prop("onChange")({ target: { value: "baz" } });
            expect(onFind).toHaveBeenCalledWith(props.refId, "baz", props.verified, 1);
        });

        it("when the filter button is clicked", () => {
            wrapper.find("#verified-button").prop("onClick")();
            expect(onFind).toHaveBeenCalledWith(props.refId, props.term, !props.verified, 1);
        });
    });
});
