import { IDRowComponent } from "./IDRow";

describe("<IDRow />", () => {
    let props;
    let wrapper;

    it("when [account.settings.show_ids=false], renders nothing (null)", () => {
        props = { id: "test_id", showIds: false };
        wrapper = shallow(<IDRowComponent {...props} />);

        expect(wrapper.html()).toBe(null);
        expect(wrapper).toMatchSnapshot();
    });

    describe("when [account.settings.show_ids=true]: ", () => {
        
        beforeEach(() => {
            props = { id: "test_id", showIds: true };
            wrapper = mount(
                <table>
                    <tbody>
                        <IDRowComponent {...props} />
                    </tbody>
                </table>
            );
        });

        it("renders correctly", () => {
            expect(wrapper).toMatchSnapshot();
        });

        it("renders a table row with a header and the target's unique database id", () => {
            
            expect(wrapper.find('tr').exists()).toBe(true);
            expect(wrapper.find('th').text()).toEqual("Unique ID");
            expect(wrapper.find('td').text()).toEqual(props.id);
        });

    });

});
