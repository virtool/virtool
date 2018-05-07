import React from "react";
import PropTypes from "prop-types";
import Dropzone from "react-dropzone";
import { Modal, Panel, Table, ProgressBar } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { uploadImport, commitImport } from "../actions";
import { Button, RelativeTime } from "../../base";
import { routerLocationHasState } from "../../utils";

const getInitialState = () => ({
    uploadProgress: 0
});

class OTUImport extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        onHide: PropTypes.func,
        importData: PropTypes.object,
        onDrop: PropTypes.func,
        onCommit: PropTypes.func
    };

    handleCommit = () => {
        this.props.onCommit(this.props.importData.file_id);
    };

    handleDrop = (files) => {
        this.props.onDrop(files[0], this.handleProgress);
    };

    handleProgress = (e) => {
        this.setState({uploadProgress: e.percent});
    };

    render () {
        let body;
        let footer;

        if (this.props.importData === null) {
            body = (
                <div>
                    <Dropzone className="dropzone" onDrop={this.handleDrop}>
                        <span>Drag or click here to upload a <strong>otus.json.gz</strong> file.</span>
                    </Dropzone>

                    <p className="text-center small">
                        {this.state.uploadProgress}
                    </p>
                </div>
            );
        } else {
            const data = this.props.importData;

            if (data.duplicates || data.errors) {
                body = <strong>The import file is invalid.</strong>;
            } else {
                let progress;

                if (data.inProgress) {
                    progress = (
                        <Panel>
                            <Panel.Body>
                                <ProgressBar now={data.inserted || 0 / data.totals.otus * 100} />
                                <p className="text-center text-muted">
                                    <small>Inserted {data.inserted} of {data.totals.otus}</small>
                                </p>
                            </Panel.Body>
                        </Panel>
                    );
                }

                body = (
                    <div>
                        {progress}

                        <Table bordered>
                            <tbody>
                                <tr>
                                    <th>Created</th>
                                    <td><RelativeTime time={data.file_created_at} /></td>
                                </tr>
                                <tr>
                                    <th>Version</th>
                                    <td>{data.version || "None"}</td>
                                </tr>
                                <tr>
                                    <th>OTUs</th>
                                    <td>{data.totals.otus}</td>
                                </tr>
                                <tr>
                                    <th>Isolates</th>
                                    <td>{data.totals.isolates}</td>
                                </tr>
                                <tr>
                                    <th>Sequences</th>
                                    <td>{data.totals.sequences}</td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                );

                footer = (
                    <Modal.Footer>
                        <Button bsStyle="primary" icon="checkmark" onClick={this.handleCommit} pullRight>
                            Import
                        </Button>
                    </Modal.Footer>
                );
            }
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Import OTUs
                </Modal.Header>

                <Modal.Body>
                    {body}
                </Modal.Body>

                {footer}
            </Modal>
        );
    }

}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "otuImport"),
    importData: state.otus.importData
});

const mapDispatchToProps = dispatch => ({

    onCommit: (fileId) => {
        dispatch(commitImport(fileId));
    },

    onDrop: (file, onProgress) => {
        dispatch(uploadImport(file, onProgress));
    },

    onHide: () => {
        dispatch(push({...window.location, state: {importotus: false}}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(OTUImport);


