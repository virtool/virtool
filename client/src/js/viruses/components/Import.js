/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import Dropzone from "react-dropzone";
import { Panel } from "react-bootstrap";

import { Button } from "../../components/Base";
import { uploadImport, commitImport } from "../actions";

const getInitialState = () => {
    return {
        uploadProgress: 0
    };
};

class VirusImport extends React.Component {


    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        importData: PropTypes.object,
        onDrop: PropTypes.func,
        onCommit: PropTypes.func
    };

    handleProgress = (progress) => {
        this.setState({uploadProgress: progress});
    };

    handleCommit = () => {
        this.props.onCommit(this.props.importData.file_id);
    };

    render () {
        let content;

        if (this.props.importData === null) {
            content = (
                <div>
                    <Dropzone className="dropzone" onDrop={(files) => this.props.onDrop(files[0], this.handleProgress)}>
                        <span>Drag or click here to upload a <strong>viruses.json.gz</strong> file.</span>
                    </Dropzone>

                    <p className="text-center small">
                        {this.state.uploadProgress}
                    </p>
                </div>
            );
        } else {
            const data = this.props.importData;

            if (!data.duplicates && !data.errors) {
                const footer = (
                    <div className="clearfix">
                        <Button bsStyle="primary" icon="checkmark" onClick={this.handleCommit} pullRight>
                            Import
                        </Button>
                    </div>
                );

                content = (
                    <Panel footer={footer}>
                        <h5>
                            <strong>The import file is valid.</strong> The following will be imported:
                        </h5>

                        <ul>
                            <li>{data.virus_count} viruses</li>
                            <li>{data.isolate_count} isolates</li>
                            <li>{data.sequence_count} sequences</li>
                        </ul>
                    </Panel>
                );
            } else {
                content = (
                    <Panel bsStlye="danger">
                        <strong>The import file is invalid.</strong>
                    </Panel>
                );
            }
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>
                        Import Viruses
                    </strong>
                </h3>

                {content}
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        importData: state.viruses.importData
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onDrop: (file, onProgress) => {
            dispatch(uploadImport(file, onProgress));
        },

        onCommit: (fileId) => {
            dispatch(commitImport(fileId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusImport);

export default Container;


