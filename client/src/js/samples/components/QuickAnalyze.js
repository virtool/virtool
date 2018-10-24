/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports QuickAnalyze *
 */
import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { analyze } from "../../analyses/actions";
import { updateAccountSettings } from "../../account/actions";
import { AlgorithmSelect, InputError, Checkbox, Button } from "../../base";
import { routerLocationHasState } from "../../utils";

const getInitialState = ({ algorithm = "pathoscope_bowtie" }) => ({
  algorithm,
  useAsDefault: false,
  skipQuickAnalyzeDialog: false
});

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
class QuickAnalyze extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialState(props);
  }

  modalExited = () => {
    this.setState(getInitialState(this.props));
  };

  handleSetAlgorithm = e => {
    this.setState({
      algorithm: e.target.value
    });
  };

  handleSkipAnalysisDialog = () => {
    this.setState({
      skipQuickAnalyzeDialog: !this.state.skipQuickAnalyzeDialog
    });
  };

  handleSubmit = e => {
    e.preventDefault();
    this.props.onAnalyze({ id: this.props.id, ...this.state });
  };

  handleUseAsDefault = () => {
    this.setState({
      useAsDefault: !this.state.useAsDefault
    });
  };

  render() {
    return (
      <Modal
        bsSize="small"
        show={this.props.show}
        onHide={this.props.onHide}
        onExited={this.modalExited}
      >
        <form onSubmit={this.handleSubmit}>
          <Modal.Header onHide={this.props.onHide} closeButton>
            Quick Analyze
          </Modal.Header>

          <Modal.Body>
            <InputError
              label="Sample"
              value={this.props.show ? this.props.quickAnalyze.name : ""}
              readOnly
            />

            <AlgorithmSelect
              value={this.state.algorithm}
              onChange={this.handleSetAlgorithm}
            />

            <Checkbox
              label="Set as default algorithm"
              checked={
                this.state.useAsDefault || this.state.skipQuickAnalyzeDialog
              }
              onClick={this.handleUseAsDefault}
            />

            <Checkbox
              label="Skip this dialog from now on"
              checked={this.state.skipQuickAnalyzeDialog}
              onClick={this.handleSkipAnalysisDialog}
            />
          </Modal.Body>

          <Modal.Footer>
            <Button type="submit" bsStyle="primary" icon="plus-square">
              Create
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    );
  }
}

const mapStateToProps = state => ({
  ...(state.router.location.state || {}),
  algorithm: state.account.settings.quick_analyze_algorithm,
  show: routerLocationHasState(
    state,
    "quickAnalyze",
    state.router.location.state
      ? state.router.location.state["quickAnalyze"]
      : false
  )
});

const mapDispatchToProps = dispatch => ({
  onAnalyze: ({ id, algorithm, useAsDefault, skipQuickAnalyzeDialog }) => {
    dispatch(analyze(id, algorithm));

    const settingsUpdate = {
      skip_quick_analyze_dialog: skipQuickAnalyzeDialog
    };

    if (useAsDefault) {
      settingsUpdate.quick_analyze_algorithm = algorithm;
    }

    dispatch(updateAccountSettings(settingsUpdate));
  },

  onHide: () => {
    dispatch(push({ ...window.location, state: {} }));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(QuickAnalyze);
