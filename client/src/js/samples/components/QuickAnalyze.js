/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports QuickAnalyze
 *
 */


import React from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { analyze } from "../actions";
import { AlgorithmSelect, Input, Checkbox, Button } from "../../base";

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

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
    }

    modalExited = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onAnalyze(this.props.id, this.state.algorithm);
    };

    render () {
        return (
            <Modal bsSize="small" show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Header onHide={this.props.onHide} closeButton>
                        Quick Analyze
                    </Modal.Header>

                    <Modal.Body>
                        <Input
                            label="Sample"
                            value={this.props.name}
                            readOnly
                        />

                        <AlgorithmSelect
                            value={this.state.algorithm}
                            onChange={(e) => this.setState({algorithm: e.target.value})}
                        />

                        <Checkbox
                            label="Set as default algorithm"
                            checked={this.state.useAsDefault || this.state.skipQuickAnalyzeDialog}
                            onClick={() => this.setState({useAsDefault: !this.state.useAsDefault})}
                        />

                        <Checkbox
                            label="Skip this dialog from now on"
                            checked={this.state.skipQuickAnalyzeDialog}
                            onClick={() => this.setState({skipQuickAnalyzeDialog: !this.state.skipQuickAnalyzeDialog})}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="new-entry">
                            Create
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        algorithm: state.account.settings.quick_analyze_algorithm
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onAnalyze: (sampleId, algorithm) => {
            dispatch(analyze(sampleId, algorithm));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(QuickAnalyze);

export default Container;
