import React from "react";
import { includes, map } from "lodash-es";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import { updateSetting, updateSettings } from "../../actions";
import { Help, InputError } from "../../../base";
import AdministrationSection from "../Section";

const SampleRights = props => {
  const rights = [
    { label: "None", value: "" },
    { label: "Read", value: "r" },
    { label: "Read & write", value: "rw" }
  ];

  const options = map(rights, (entry, index) => (
    <option key={index} value={entry.value}>
      {entry.label}
    </option>
  ));

  const content = (
    <Panel.Body>
      <label className="control-label" style={{ width: "100%" }}>
        <span>Sample Group</span>
        <Help pullRight>
          <p>
            <strong>None</strong>: samples are assigned no group and only
            <em> all {"users'"}</em> rights apply
          </p>
          <p>
            <strong>{"User's"} primary group</strong>: samples are automatically
            assigned the creating {"user's"} primary group
          </p>
          <p>
            <strong>Choose</strong>: samples are assigned by the user in the
            creation form
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
        <option value="users_primary_group">{"User's"} primary group</option>
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
    </Panel.Body>
  );

  return (
    <AdministrationSection
      title="Default Sample Rights"
      description="Set the method used to assign groups to new samples and the default rights."
      content={content}
    />
  );
};

const mapStateToProps = state => {
  const settings = state.settings.data;

  return {
    sampleGroup: settings.sample_group,
    group:
      (settings.sample_group_read ? "r" : "") +
      (settings.sample_group_write ? "w" : ""),
    all:
      (settings.sample_all_read ? "r" : "") +
      (settings.sample_all_write ? "w" : "")
  };
};

const mapDispatchToProps = dispatch => ({
  onChangeSampleGroup: value => {
    dispatch(updateSetting("sample_group", value));
  },

  onChangeRights: (level, value) => {
    const update = {};

    update[`sample_${level}_read`] = includes(value, "r");
    update[`sample_${level}_write`] = includes(value, "w");

    dispatch(updateSettings(update));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SampleRights);
