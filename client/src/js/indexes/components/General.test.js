import { Badge } from "react-bootstrap";
import IndexGeneral, { PanelBadgeHeader, IndexOTUEntry } from "./General";

describe("<General />", () => {
    const initialState = {
        indexes: {
            detail: {
                reference: { id: "test-reference" },
                contributors: [{ id: "test-user", count: 5 }],
                otus: [{ id: "123abc", name: "test-otu", change_count: 1 }]
            }
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<IndexGeneral store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(Badge).html()).toEqual('<span class="badge">5 changes</span>');

        const newState = {
            indexes: {
                detail: {
                    ...initialState.indexes.detail,
                    contributors: [{ id: "test-user-2", count: 1 }]
                }
            }
        };
        const newStore = mockStore(newState);
        wrapper = shallow(<IndexGeneral store={newStore} />).dive();
        expect(wrapper.find(Badge).html()).toEqual('<span class="badge">1 change</span>');
    });

    it("renders <PanelBadgeHeader /> subcomponent", () => {
        props = {
            title: "test",
            count: 10
        };
        wrapper = shallow(<PanelBadgeHeader {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <IndexOTUEntry /> subcomponent", () => {
        props = {
            refId: "test-reference",
            changeCount: 3,
            id: "test-index",
            name: "test"
        };
        wrapper = shallow(<IndexOTUEntry {...props} />);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.childAt(1).html()).toEqual('<span class="badge">3 changes</span>');

        wrapper.setProps({ changeCount: 1 });
        expect(wrapper.childAt(1).html()).toEqual('<span class="badge">1 change</span>');
    });
});
