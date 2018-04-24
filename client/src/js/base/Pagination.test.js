import { Pagination } from "./Pagination";
import { Pagination as BSPagination } from "@react-bootstrap/pagination";

describe("<Pagination />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            documentCount: 100,
            onPage: jest.fn(),
            page: 3,
            pageCount: 20
        };
        wrapper = shallow(<Pagination {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("does not render if documentCount is 0 or otherwise falsey", () => {
        props = {
            documentCount: 0,
            onPage: jest.fn(),
            page: 3,
            pageCount: 20
        };
        wrapper = shallow(<Pagination {...props} />);

        expect(wrapper.equals(null)).toBe(true);

        props = {
            documentCount: undefined,
            onPage: jest.fn(),
            page: 3,
            pageCount: 20
        };
        wrapper = shallow(<Pagination {...props} />);

        expect(wrapper.equals(null)).toBe(true);
    });

    it("page number buttons are clickable", () => {
        props = {
            documentCount: 1,
            onPage: jest.fn(),
            page: 1,
            pageCount: 20
        };
        wrapper = shallow(<Pagination {...props} />);

        wrapper.find(BSPagination).simulate('select');

        expect(props.onPage).toHaveBeenCalled();
    });

});
