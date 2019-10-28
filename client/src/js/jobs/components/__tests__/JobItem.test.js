import { JobItem, mapDispatchToProps } from "../Item";

describe("<JobItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            progress: 1,
            state: "bar",
            task: "baz",
            created_at: "Foo",
            user: {
                id: "Bar"
            },
            canCancel: true,
            canRemove: true,
            handleCancel: "Baz",
            handleRemove: "foe"
        };
    });
    it("should render", () => {
        const wrapper = shallow(<JobItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapDispatchToProps", () => {
    it("should return onCancel() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onCancel("foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: "CANCEL_JOB_REQUESTED",
            jobId: "foo"
        });
    });
    it("should return onNavigate() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onNavigate("foo");
        expect(dispatch).toHaveBeenCalledWith({
            payload: { args: ["/jobs/foo"], method: "push" },
            type: "@@router/CALL_HISTORY_METHOD"
        });
    });
    it("should return onRemove() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onRemove("foo");
        expect(dispatch).toHaveBeenCalledWith({
            jobId: "foo",
            type: "REMOVE_JOB_REQUESTED"
        });
    });
});
