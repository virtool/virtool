import * as actions from "../../actions";
import { Button } from "../../../base/index";
import UniqueNamesContainer from "./UniqueNames";

describe("<UniqueNames />", () => {
    const initialState = {
        settings: {
            data: { sample_unique_names: true }
        }
    };
    const store = mockStore(initialState);
    let wrapper;
    let spy;

    it("renders correctly", () => {
        wrapper = shallow(<UniqueNamesContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("dispatches updateSettings when enable checkbox is toggled", () => {
        spy = sinon.spy(actions, "updateSetting");
        expect(spy.called).toBe(false);

        wrapper = mount(<UniqueNamesContainer store={store} />);
        wrapper.find(Button).prop("onClick")();

        expect(spy.calledWith("sample_unique_names", false)).toBe(true);

        spy.restore();
    });
});
