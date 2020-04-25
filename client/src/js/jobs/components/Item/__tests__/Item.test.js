import { JobItem, mapDispatchToProps } from "../Item";

describe("<JobItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            progress: 1,
            task: "build_index",
            created_at: "Foo",
            user: {
                id: "bob"
            },
            canCancel: true,
            canRemove: true,
            onCancel: jest.fn(),
            onRemove: jest.fn()
        };
    });

    it.each(["waiting", "running", "cancelled", "error", "complete"])("should render when [state=%p]", state => {
        props.state = state;
        const wrapper = shallow(<JobItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each([
        [true, true],
        [true, false],
        [false, true],
        [false, false]
    ])("should render when [canCancel=%p] and [canRemove=%p]", (canCancel, canRemove) => {
        props = {
            ...props,
            canCancel,
            canRemove
        };
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
