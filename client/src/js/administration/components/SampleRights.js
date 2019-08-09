import React from "react";
import { includes, map } from "lodash-es";
import { connect } from "react-redux";
import { updateSetting, updateSettings } from "../actions";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, Help, InputError } from "../../base";

const rights = [{ label: "None", value: "" }, { label: "Read", value: "r" }, { label: "Read & write", value: "rw" }];

export const SampleRights = props => {
    const options = map(rights, (entry, index) => (
        <option key={index} value={entry.value}>
            {entry.label}
        </option>
    ));

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>Default Sample Rights</h2>
                <p>Set the method used to assign groups to new samples and the default rights.</p>
            </BoxGroupHeader>
            <BoxGroupSection>
                <label className="control-label" style={{ width: "100%" }}>
                    <span>Sample Group</span>
                    <Help pullRight>
                        <p>
                            <strong>None</strong>: samples are assigned no group and only
                            <em> all users'</em> rights apply
                        </p>
                        <p>
                            <strong>User's primary group</strong>: samples are automatically assigned the creating{" "}
                            user's primary group
                        </p>
                        <p>
                            <strong>Choose</strong>: samples are assigned by the user in the creation form
                        </p>
                    </Help>
                </label>

                <InputError
                    type="select"
                    value={props.sampleGroup}
                    onChange={e => props.onChangeSampleGroup(e.target.value)}
                >
                    <option value="none">None</option>
                    <option value="force_choice">Force choice</option>
                    <option value="users_primary_group">User's primary group</option>
                </InputError>

                <InputError
                    type="select"
                    label="Group Rights"
                    value={props.group}
                    onChange={e => props.onChangeRights("group", e.target.value)}
                >
                    {options}
                </InputError>

                <InputError
                    name="all"
                    type="select"
                    label="All Users' Rights"
                    value={props.all}
                    onChange={e => props.onChangeRights("all", e.target.value)}
                >
                    {options}
                </InputError>
            </BoxGroupSection>
        </BoxGroup>
    );
};

export const mapStateToProps = state => {
    const settings = state.settings.data;

    return {
        sampleGroup: settings.sample_group,
        group: (settings.sample_group_read ? "r" : "") + (settings.sample_group_write ? "w" : ""),
        all: (settings.sample_all_read ? "r" : "") + (settings.sample_all_write ? "w" : "")
    };
};

export const mapDispatchToProps = dispatch => ({
    onChangeSampleGroup: value => {
        dispatch(updateSetting("sample_group", value));
    },

    onChangeRights: (scope, value) => {
        dispatch(
            updateSettings({
                [`sample_${scope}_read`]: includes(value, "r"),
                [`sample_${scope}_write`]: includes(value, "w")
            })
        );
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleRights);
