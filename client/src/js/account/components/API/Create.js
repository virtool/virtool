import CX from "classnames";
import { mapValues } from "lodash-es";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";

import { Button, Flex, FlexItem, Icon, Input, InputError, Modal, SaveButton } from "../../../base";
import { routerLocationHasState } from "../../../utils/utils";
import { clearAPIKey, createAPIKey } from "../../actions";
import CreateAPIKeyInfo from "./CreateInfo";
import APIPermissions from "./Permissions";

export const getInitialState = props => ({
    name: "",
    permissions: mapValues(props.permissions, () => false),
    submitted: false,
    copied: false,
    error: "",
    show: false
});

export class CreateAPIKey extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.show && nextProps.newKey) {
            return { show: true };
        }
        return null;
    }

    handleChange = e => {
        this.setState({ name: e.target.value, error: "" });
    };

    handleCopy = () => {
        this.setState({ copied: true });
    };

    handleModalExited = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = e => {
        e.preventDefault();

        const { name, permissions } = this.state;

        if (!this.state.name) {
            this.setState({
                error: "Required Field"
            });
            return;
        }

        this.setState({ submitted: true }, () => {
            this.props.onCreate(name, permissions);
        });
    };

    handlePermissionChange = (key, value) => {
        this.setState({ permissions: { ...this.state.permissions, [key]: value } });
    };

    render() {
        let content;

        if (this.state.show) {
            content = (
                <Modal.Body className="text-center">
                    <Row>
                        <Col xs={12}>
                            <strong className="text-success">Here is your key.</strong>
                        </Col>
                    </Row>

                    <small>Make note of it now. For security purposes, it will not be shown again.</small>

                    <Row style={{ marginTop: "10px", marginBottom: "5px" }}>
                        <Col xs={12} md={8} mdOffset={2}>
                            <Flex alignItems="stretch" alignContent="stretch">
                                <FlexItem grow={1}>
                                    <Input
                                        style={{ marginBottom: 0 }}
                                        formGroupStyle={{ marginBottom: 0 }}
                                        className="text-center"
                                        value={this.props.newKey}
                                        readOnly
                                    />
                                </FlexItem>
                                <CopyToClipboard text={this.props.newKey} onCopy={this.handleCopy}>
                                    <Button icon="paste" bsStyle="primary" />
                                </CopyToClipboard>
                            </Flex>
                        </Col>
                    </Row>

                    <small className={CX("text-primary", { invisible: !this.state.copied })}>
                        <Icon name="check" /> Copied
                    </small>
                </Modal.Body>
            );
        } else {
            content = (
                <React.Fragment>
                    <CreateAPIKeyInfo />
                    <form onSubmit={this.handleSubmit}>
                        <Modal.Body>
                            <InputError
                                label="Name"
                                value={this.state.name}
                                onChange={this.handleChange}
                                error={this.state.error}
                            />

                            <label>Permissions</label>

                            <APIPermissions
                                keyPermissions={this.state.permissions}
                                onChange={this.handlePermissionChange}
                            />
                        </Modal.Body>

                        <Modal.Footer>
                            <SaveButton />
                        </Modal.Footer>
                    </form>
                </React.Fragment>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create API Key
                </Modal.Header>

                {content}
            </Modal>
        );
    }
}

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createAPIKey"),
    newKey: state.account.newKey,
    permissions: state.account.permissions
});

export const mapDispatchToProps = dispatch => ({
    onCreate: (name, permissions) => {
        dispatch(createAPIKey(name, permissions));
    },

    onHide: () => {
        dispatch(pushState({ createAPIKey: false }));
        dispatch(clearAPIKey());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateAPIKey);
