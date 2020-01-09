import { ReferenceManage } from "../Manage";

describe("<ReferenceManage />", () => {
    let props;
    beforeEach(() => {
        props = {
            detail: {
                id: "foo",
                cloned_from: "bar",
                contributors: "baz",
                description: "boo",
                latest_build: "Foo",
                organism: "Bar",
                remotes_from: "Boo"
            }
        };
    });
    it("should render", () => {
        const wrapper = shallow(<ReferenceManage {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
