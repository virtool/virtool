import { Button } from "../../../../base/index";
import RemoveSegment from "../RemoveSegment";

describe("<RemoveSegment />", () => {
    const initialState = {
        otus: {
            detail: {
                schema: [{ name: "hello" }, { name: "world" }, { name: "test" }]
            }
        }
    };
    const store = mockStore(initialState);
    const props = {
        show: true,
        onHide: jest.fn(),
        onSubmit: sinon.spy(),
        curSeg: { name: "test" }
    };
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<RemoveSegment store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("Clicking Confirm button calls onSubmit callback prop", () => {
        expect(props.onSubmit.called).toBe(false);

        wrapper = mount(<RemoveSegment store={store} {...props} />);
        wrapper.find(Button).prop("onClick")();

        expect(props.onSubmit.calledWith([{ name: "hello" }, { name: "world" }])).toBe(true);
    });
});
