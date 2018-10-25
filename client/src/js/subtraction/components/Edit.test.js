import * as actions from "../actions";
import EditSubtractionContainer, { EditSubtraction } from "./Edit";

describe("<EditSubtraction />", () => {
    let props;
    let wrapper;
    let spy;

    beforeEach(() => {
        props = {
            show: true,
            entry: {
                id: "123abc",
                file: { name: "test-file" },
                nickname: "foo"
            },
            exited: jest.fn()
        };
    });

    it("renders correctly", () => {
        props = {
            ...props,
            onUpdate: jest.fn()
        };
        wrapper = shallow(<EditSubtraction {...props} />);
        wrapper.find({ label: "Nickname" }).prop("onChange")({
            target: { value: "test-nickname" }
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("Submitting form dispatches updateSubtraction() action", () => {
        spy = sinon.spy(actions, "updateSubtraction");
        expect(spy.called).toBe(false);

        const store = mockStore({});

        wrapper = shallow(<EditSubtractionContainer store={store} {...props} />).dive();
        wrapper.find("form").prop("onSubmit")({ preventDefault: jest.fn() });
        expect(spy.calledWith(props.entry.id, props.entry.nickname)).toBe(true);

        spy.restore();
    });
});
