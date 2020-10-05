import { HMMInstaller, mapStateToProps, mapDispatchToProps } from "../Installer";

describe("<HMMInstaller />", () => {
    let props;

    beforeEach(() => {
        props = {
            releaseId: "foo",
            task: { progress: "foo", step: "bar" },
            installed: false
        };
    });

    it("should render when [this.props.task exists] and [this.props.installed=false]", () => {
        const wrapper = shallow(<HMMInstaller {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [this.props.task = undefined] and [this.props.installed = false]", () => {
        props.task = undefined;
        const wrapper = shallow(<HMMInstaller {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [this.props.task exists] and [this.props.installed=true]", () => {
        props.installed = true;
        const wrapper = shallow(<HMMInstaller {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [this.props.task = undefined] and [this.props.installed = true]", () => {
        props.task = undefined;
        props.installed = true;
        const wrapper = shallow(<HMMInstaller {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            taskId: 1,

            account: {
                permissions: { foo: "bar" },
                administrator: true
            },
            hmms: {
                status: {
                    task: { id: "foo" },
                    release: { id: "bar" },
                    installed: true
                }
            },
            tasks: {
                documents: [{ foo: "bar" }, { id: "foo" }],
                id: 1,
                progress: 10
            }
        };

        const result = mapStateToProps(state);
        expect(result).toEqual({
            canInstall: true,
            installed: true,
            task: { id: "foo" },
            releaseId: "bar"
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return onInstall in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onInstall("foo");
        expect(dispatch).toHaveBeenCalledWith({ release_id: "foo", type: "INSTALL_HMMS_REQUESTED" });
    });
});
