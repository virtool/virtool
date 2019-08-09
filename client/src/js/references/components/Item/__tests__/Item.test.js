import { ReferenceItem, mapStateToProps } from "../Item";
import { getReferenceItemProgress } from "../../../selectors";

jest.mock("../../../selectors");

describe("<Item />", () => {
    let props;

    beforeEach(() => {
        props = {
            clonedFrom: {
                id: "clonedFrom"
            },
            createdAt: "2018-01-01T00:00:00.000000Z",
            id: "foo",
            importedFrom: {
                id: "importedFrom"
            },
            latestBuild: {
                id: "bar"
            },
            name: "Foo",
            organism: "virus",
            progress: 32,
            remotesFrom: {
                id: "remotesFrom"
            },
            userId: "bob"
        };
    });

    it("should render when [organism='virus'] and [progress=32]", () => {
        const wrapper = shallow(<ReferenceItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [organism=null]", () => {
        props.organism = null;
        const wrapper = shallow(<ReferenceItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [progress=100]", () => {
        props.progress = 100;
        const wrapper = shallow(<ReferenceItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it.each([0, 32, 100])("should return props when [progress=%p]", progress => {
        getReferenceItemProgress.mockReturnValue(progress);
        const state = {
            references: {
                documents: [
                    {
                        id: "bar"
                    },
                    {
                        id: "foo",
                        cloned_from: {
                            id: "clonedFrom"
                        },
                        created_at: "2018-01-01T00:00:00.000000Z",
                        imported_from: {
                            id: "importedFrom"
                        },
                        latest_build: {
                            id: "baz",
                            version: 2
                        },
                        name: "Foo",
                        organism: "virus",
                        process: {
                            id: "boo"
                        },
                        remotes_from: {
                            id: "remotesFrom"
                        },
                        user: {
                            id: "bob"
                        }
                    }
                ]
            }
        };
        const props = mapStateToProps(state, { index: 1 });
        expect(props).toEqual({
            clonedFrom: {
                id: "clonedFrom"
            },
            createdAt: "2018-01-01T00:00:00.000000Z",
            id: "foo",
            importedFrom: {
                id: "importedFrom"
            },
            latestBuild: {
                id: "baz",
                version: 2
            },
            name: "Foo",
            organism: "virus",
            progress,
            remotesFrom: {
                id: "remotesFrom"
            },
            userId: "bob"
        });
        expect(getReferenceItemProgress).toHaveBeenCalledWith(state, 1);
    });
});
