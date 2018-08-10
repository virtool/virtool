import InternalControlContainer from "./InternalControl";

describe("<InternalControl />", () => {
    const initialState = {
        settings: {
            data: {},
            readahead: null,
            readaheadPending: false
        },
        references: {
            detail: {
                internalControl: null,
                id: "123abc",
                remotes_from: null
            }
        }
    };
    const store = mockStore(initialState);
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<InternalControlContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });
});
