import { JobStatus } from "../Status";

describe("<JobStatusIcon />", () => {
    describe.each([true, false])("should render when [pad=%p]", pad => {
        const props = { pad };

        it.each(["waiting", "running", "cancelled", "error", "complete"])("and [state=%p]", state => {
            props.state = state;
            const wrapper = shallow(<JobStatus {...props} />);
            expect(wrapper).toMatchSnapshot();
        });
    });
});
