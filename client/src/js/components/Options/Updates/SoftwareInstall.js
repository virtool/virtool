import React, { PropTypes } from "react";
import Marked from "marked";
import { Modal, ListGroup } from "react-bootstrap";
import { ListGroupItem, Button, Checkbox } from "virtool/js/components/Base";

const getInitialState = () => ({
    displayNotification: true,
    deleteTemporary: true,
    forcefullyCancel: false,
    shutdown: false
});

export default class SoftwareInstall extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool.isRequired,
        onHide: PropTypes.func.isRequired,
        release: PropTypes.object.isRequired
    };

    render () {
        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExit={() => this.setState(getInitialState())}>
                <Modal.Header>
                    Install Software Update
                </Modal.Header>
                <Modal.Body>
                    <ListGroup style={{margin: 0}}>
                        <ListGroupItem>
                            <h5><strong>Virtool {this.props.release.name}</strong></h5>
                            <div dangerouslySetInnerHTML={{__html: Marked(this.props.release.body)}} />
                        </ListGroupItem>
                        <ListGroupItem>
                            <h5>
                                <Checkbox
                                    label="Display notification to users"
                                    checked={this.state.displayNotification}
                                    onClick={() =>
                                        this.setState({displayNotification: !this.state.displayNotification})
                                    }
                                />
                            </h5>
                            <h5>
                                <Checkbox
                                    label="Shutdown when complete instead of restarting"
                                    checked={this.state.shutdown}
                                    onClick={() => this.setState({shutdown: !this.state.shutdown})}
                                />
                            </h5>
                            <h5>
                                <Checkbox
                                    label="Delete temporary files when complete"
                                    checked={this.state.deleteTemporary}
                                    onClick={() => this.setState({deleteTemporary: !this.state.deleteTemporary})}
                                />
                            </h5>
                            <h5 className="text-danger">
                                <Checkbox
                                    label="Forcefully cancel all running jobs"
                                    checked={this.state.forcefullyCancel}
                                    onClick={() => this.setState({forcefullyCancel: !this.state.forcefullyCancel})}
                                />
                            </h5>
                        </ListGroupItem>
                        <ListGroupItem bsStyle="warning">
                            <h5>
                                This update will wait for all running jobs to finish unless configured otherwise.
                            </h5>
                            <h5>
                                Users will be prevented from submitting jobs until the update is complete.
                            </h5>
                            <h5>
                                Virtool will restart when the update completes. Client updates will
                                occur on restart.
                            </h5>
                            <h5>
                                Interrupting the update process may corrupt the Virtool installation.
                            </h5>
                        </ListGroupItem>
                    </ListGroup>
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" icon="arrow-up" pullRight>
                        Update
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
