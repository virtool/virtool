import React from "react";
import { Alert } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button, ProgressBar } from "virtool/js/components/Base";
import SoftwareInstallForm from "./SoftwareInstallForm";
import SoftwareInstallDetail from "./SoftwareInstallDetail";

export default class SoftwareNotification extends React.Component {

    constructor (props) {
        super(props);
        this.state = {showModal: false};
    }

    static propTypes = {
        latestRelease: React.PropTypes.object,
        installDocument: React.PropTypes.object
    };

    render () {
        if (this.props.installDocument) {
            const progress = calculateOverallProgress(
                this.props.installDocument.step,
                this.props.installDocument.progress
            );

            return (
                <Alert bsStyle="info">
                    <Flex alignItems="center">
                        <Icon name="info" />
                        <FlexItem pad>
                            Update in Progress
                        </FlexItem>
                        <FlexItem grow={1} pad={25}>
                            <ProgressBar now={progress * 100} style={{marginBottom: 0}} />
                        </FlexItem>
                        <Button
                            style={{marginLeft: "20px"}}
                            bsSize="small"
                            onClick={() => this.setState({showModal: true})}
                        >
                        Detail
                    </Button>
                    </Flex>

                    <SoftwareInstallDetail
                        show={this.state.showModal}
                        onHide={() => this.setState({showModal: false})}
                        installDocument={this.props.installDocument}
                        progress={progress}
                    />
                </Alert>
            );
        }

        return (
            <Alert bsStyle="success">
                <Flex alignItems="center">
                    <FlexItem grow={1}>
                        <span><Icon name="notification" /> <strong>Update available</strong></span>
                    </FlexItem>
                    <Button
                        bsStyle="success"
                        bsSize="small"
                        icon="arrow-up"
                        onClick={() => this.setState({showModal: true})}
                    >
                        Update
                    </Button>
                </Flex>

                <SoftwareInstallForm
                    show={this.state.showModal}
                    onHide={() => this.setState({showModal: false})}
                    latestRelease={this.props.latestRelease}
                />
            </Alert>
        );
    }
}

export const steps = [
    "block_jobs",
    "download",
    "decompress",
    "check_tree",
    "copy_files"
];

export const calculateOverallProgress = (step, progress) => steps.indexOf(step) / 5 + progress * 0.2;
