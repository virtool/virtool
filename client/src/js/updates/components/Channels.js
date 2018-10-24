import { capitalize, map } from "lodash-es";
import React from "react";
import { Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { updateSetting } from "../../administration/actions";
import { Radio } from "../../base";

export class ChannelButton extends React.Component {
  handleClick = () => {
    this.props.onClick(this.props.channel);
  };

  render() {
    const { channel, checked } = this.props;

    return (
      <Radio
        label={`${capitalize(channel)}${
          channel === "stable" ? " (recommended)" : ""
        }`}
        checked={checked}
        onClick={this.handleClick}
      />
    );
  }
}

export const SoftwareChannels = ({ channel, onSetSoftwareChannel }) => {
  const radioComponents = map(["stable", "beta", "alpha"], label => (
    <ChannelButton
      key={label}
      channel={label}
      checked={label === channel}
      onClick={onSetSoftwareChannel}
    />
  ));

  return (
    <Panel>
      <Panel.Body>
        <label>Software Channel</label>
        {radioComponents}
      </Panel.Body>
    </Panel>
  );
};

const mapStateToProps = state => ({
  channel: state.settings.data.software_channel
});

const mapDispatchToProps = dispatch => ({
  onSetSoftwareChannel: value => {
    dispatch(updateSetting("software_channel", value));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SoftwareChannels);
