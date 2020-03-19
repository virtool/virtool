import { UPDATE_SETTINGS } from "../../../app/actionTypes";
import { Select } from "../../../base";
import { mapDispatchToProps, mapStateToProps, SampleRights } from "../SampleRights";

describe("<SampleRights />", () => {
    let props;

    beforeEach(() => {
        props = {
            sampleGroup: "force_choice",
            group: "rw",
            all: "rw",
            onChangeSampleGroup: jest.fn(),
            onChangeRights: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SampleRights {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChangeSampleGroup() when group SelectBox is clicked", () => {
        const wrapper = shallow(<SampleRights {...props} />);

        wrapper
            .find("SelectBox")
            .at(0)
            .simulate("click");
        expect(props.onChangeSampleGroup).toHaveBeenCalledWith("none");
    });
    it("should call onChangeSampleGroup() when force choice SelectBox is clicked", () => {
        const wrapper = shallow(<SampleRights {...props} />);

        wrapper
            .find("SelectBox")
            .at(1)
            .simulate("click");
        expect(props.onChangeSampleGroup).toHaveBeenCalledWith("force_choice");
    });
    it("should call onChangeSampleGroup() when users primary group SelectBox is clicked", () => {
        const wrapper = shallow(<SampleRights {...props} />);

        wrapper
            .find("SelectBox")
            .at(2)
            .simulate("click");
        expect(props.onChangeSampleGroup).toHaveBeenCalledWith("users_primary_group");
    });

    it.each(["group", "all"])("should call onChangeRights() when %p input changes", scope => {
        const wrapper = shallow(<SampleRights {...props} />);
        const e = {
            target: {
                value: "r"
            }
        };
        wrapper
            .find(Select)
            .at(scope === "all" ? 1 : 0)
            .simulate("change", e);
        expect(props.onChangeRights).toHaveBeenCalledWith(scope, "r");
    });
});

describe("mapStateToProps", () => {
    let state;
    let expected;

    beforeEach(() => {
        state = {
            settings: {
                data: {
                    sample_group: "force_choice",
                    sample_group_read: false,
                    sample_group_write: false,
                    sample_all_read: false,
                    sample_all_write: false
                }
            }
        };
        expected = { group: "", all: "", sampleGroup: "force_choice" };
    });

    it.each([
        ["group", true, true, "rw"],
        ["group", true, false, "r"],
        ["group", false, true, "w"],
        ["group", false, false, ""],
        ["all", true, true, "rw"],
        ["all", true, false, "r"],
        ["all", false, true, "w"],
        ["all", false, false, ""]
    ])("should return props when %p rw rights are (%p, %p)", (scope, read, write, result) => {
        state.settings.data[`sample_${scope}_read`] = read;
        state.settings.data[`sample_${scope}_write`] = write;
        expect(mapStateToProps(state)).toEqual({
            ...expected,
            [scope]: result
        });
    });

    it.each();
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onChangeSampleGroup in props", () => {
        props.onChangeSampleGroup("force_choice");
        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: { sample_group: "force_choice" }
        });
    });

    it.each([
        ["group", "rw", true, true],
        ["group", "r", true, false],
        ["group", "w", false, true],
        ["group", "", false, false],
        ["all", "rw", true, true],
        ["all", "r", true, false],
        ["all", "w", false, true],
        ["all", "", false, false]
    ])("should return onChangeRights in props that works when %s right string is %p", (scope, str, read, write) => {
        props.onChangeRights(scope, str);
        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: {
                [`sample_${scope}_read`]: read,
                [`sample_${scope}_write`]: write
            }
        });
    });
});
