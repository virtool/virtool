import { RelativeTime } from "./RelativeTime";
import Moment from "moment";

describe("<RelativeTime />", () => {
    let props;
    let wrapper;
    let expected;

    it("renders correctly", () => {
        let props = {
            time: "2018-02-14T17:12:00.000000Z"
        };
        wrapper = shallow(<RelativeTime {...props} />);

        expected = Moment(props.time).fromNow();

        expect(wrapper.text()).toEqual(expected);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders 'just now' for browser lag future times", () => {
        const futureTime = `${Moment().add(30, 'seconds').toDate().toISOString()}`;
        let props = {
            time: futureTime 
        };
        wrapper = shallow(<RelativeTime {...props} />);

        expect(wrapper.text()).toEqual("just now");
        expect(wrapper).toMatchSnapshot();
    });
});
