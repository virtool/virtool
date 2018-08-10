import SampleRightsContainer from "./SampleRights";

describe("<SampleRights />", () => {
    let initialState;
    let store;
    let props;
    let wrapper;

    it("renders correctly", () => {
        initialState = {
            settings: {
                data: {
                    sample_group: "none",
                    sample_group_read: false,
                    sample_group_write: false,
                    sample_all_read: false,
                    sample_all_write: false
                }
            }
        };
        store = mockStore(initialState);
        props = { onChangeRights: jest.fn() };
        wrapper = shallow(<SampleRightsContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();

        initialState = {
            settings: {
                data: {
                    sample_group: "none",
                    sample_group_read: true,
                    sample_group_write: true,
                    sample_all_read: true,
                    sample_all_write: true
                }
            }
        };
        store = mockStore(initialState);
        props = { onChangeRights: jest.fn() };
        wrapper = shallow(<SampleRightsContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

});
