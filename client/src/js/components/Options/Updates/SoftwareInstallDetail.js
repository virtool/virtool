import React, { PropTypes } from "react";
import { Modal, ListGroup } from "react-bootstrap";
import { Icon, ListGroupItem, ProgressBar } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

const stepDisplayText = {
    block_jobs: "Blocking future job starts",
    download: "Downloading Release",
    decompress: "Decompressing archive",
    check_tree: "Checking update files",
    copy_files: "Copying new files"
};

const getStepDisplayText = (installDocument) => {
    if (installDocument.step === "download") {
        const downloaded = byteSize(Math.round((installDocument.progress) * installDocument.size));
        return `Downloading (${downloaded}/${byteSize(installDocument.size)})`
    }

    return stepDisplayText[installDocument.step];
};

export default class SoftwareInstall extends React.PureComponent {

    static propTypes = {
        show: PropTypes.bool.isRequired,
        onHide: PropTypes.func.isRequired,
        installDocument: PropTypes.object.isRequired,
        progress: PropTypes.number.isRequired
    };

    render () {
        return (
            <Modal show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    Install Software Update
                </Modal.Header>
                <Modal.Body>
                    <ListGroup style={{margin: 0}}>
                        <ListGroupItem>
                            <h5><strong>Installing Virtool {this.props.installDocument.name}</strong></h5>
                            <ProgressBar now={this.props.progress * 100} style={{marginBottom: "5px"}} />
                            <p className="text-center">
                                <small>{getStepDisplayText(this.props.installDocument)}</small>
                            </p>
                        </ListGroupItem>

                        <ListGroupItem bsStyle="danger">
                            <h5>
                                <Icon name="warning" />
                                <span> Interrupting the update process may corrupt the Virtool installation.</span>
                            </h5>
                        </ListGroupItem>
                    </ListGroup>
                </Modal.Body>
            </Modal>
        );
    }
}
