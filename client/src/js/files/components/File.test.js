import * as actions from "../actions";
import FileContainer from "./File";

describe("<File />", () => {
    const initialState = {
        files: {
            documents: [
                {
                    id: "test-entry",
                    name: "test-file",
                    size: 10,
                    uploaded_at: "2018-02-14T17:12:00.000000Z",
                    user: { id: "test-user" }
                }
            ]
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            index: 0,
            canRemove: false
        };
        wrapper = shallow(<FileContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({
            entry: { ...initialState.files.documents[0], user: null },
            canRemove: true
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("Clicking trash icon dispatches removeFile() action", () => {
        const spy = sinon.spy(actions, "removeFile");
        expect(spy.called).toBe(false);

        props = {
            index: 0,
            canRemove: true
        };
        wrapper = mount(<FileContainer store={store} {...props} />);
        wrapper.find({ name: "trash" }).prop("onClick")();
        expect(spy.calledWith("test-entry")).toBe(true);

        spy.restore();
    });
});
