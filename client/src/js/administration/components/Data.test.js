import DataOptions, { WarningFooter } from "./Data";
import { Icon } from "../../base";

describe("<Describe />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders <DataOptions /> correctly", () => {
        initialState = {
            settings: {
                data: {
                    db_name: "virtool",
                    db_host: "test",
                    db_port: "1",
                    data_path: "/",
                    watch_path: "/",
                    onSave: jest.fn()
                }
            }
        };
        store = mockStore(initialState);
        wrapper = shallow(<DataOptions store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

    it("renders <WarningFooter /> correctly", () => {
        wrapper = shallow(<WarningFooter />);

        expect(wrapper.find("small").length).toEqual(1);
        expect(wrapper.find(Icon).length).toEqual(1);

        expect(wrapper).toMatchSnapshot();
    });

});
