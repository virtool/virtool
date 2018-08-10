import SourceTypesContainer, {
    SourceTypeItem
} from "./SourceTypes";

describe("<SourceTypes />", () => {
    const initialState = {
        references: {
            detail: {
                restrict_source_types: false,
                id: "123abc",
                remotes_from: null,
                source_types: []
            }
        },
        account: {
            administrator: false
        },
        settings: {
            data: {
                default_source_types: []
            }
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<SourceTypesContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders SourceTypeItem subcomponent", () => {
        props = {
            onRemove: jest.fn(),
            sourceType: "test",
            isDisabled: false
        };
        wrapper = shallow(<SourceTypeItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

});
