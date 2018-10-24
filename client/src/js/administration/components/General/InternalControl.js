import React from "react";
import { connect } from "react-redux";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import { Panel } from "react-bootstrap";
import { getControlReadahead } from "../../actions";
import { editReference } from "../../../references/actions";
import AdministrationSection from "../Section";

class InternalControl extends React.Component {
  render() {
    const selected = this.props.internalControlId
      ? [this.props.internalControlId]
      : [];

    const description = `Set an OTU that is spiked into samples to be used as a positive control.
        Viral abundances in a sample can be calculated as proportions relative to the control.`;

    const content = (
      <Panel.Body>
        <AsyncTypeahead
          labelKey="name"
          allowNew={false}
          isLoading={this.props.readaheadPending}
          onSearch={this.props.onGetReadahead.bind(this, this.props.refId)}
          onChange={this.props.onUpdate.bind(this, this.props.refId)}
          selected={selected}
          options={this.props.readahead || []}
          renderMenuItemChildren={option => (
            <option key={option.id}>{option.name}</option>
          )}
          disabled={!!this.props.isRemote}
        />
      </Panel.Body>
    );

    return (
      <AdministrationSection
        title="Internal Control"
        description={description}
        content={content}
      />
    );
  }
}

const mapStateToProps = state => ({
  settings: state.settings.data,
  readahead: state.settings.readahead,
  readaheadPending: state.settings.readaheadPending,
  internalControlId: state.references.detail.internal_control || null,
  refId: state.references.detail.id,
  isRemote: state.references.detail.remotes_from
});

const mapDispatchToProps = dispatch => ({
  onGetReadahead: (refId, term) => {
    dispatch(getControlReadahead(refId, term));
  },

  onUpdate: (refId, selected) => {
    const update = { internal_control: selected.length ? selected[0].id : "" };
    dispatch(editReference(refId, update));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InternalControl);
