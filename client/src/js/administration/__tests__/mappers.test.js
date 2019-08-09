import { mapSettingsStateToProps } from "../mappers";

describe("mapSettingsStateToProps()", () => {
    it("should return props when settings loading", () => {
        const props = mapSettingsStateToProps({ settings: { data: null } });
        expect(props).toEqual({
            loading: true
        });
    });

    it("should return props when settings loaded", () => {
        const props = mapSettingsStateToProps({ settings: { data: { foo: "bar" } } });
        expect(props).toEqual({
            loading: false
        });
    });
});
