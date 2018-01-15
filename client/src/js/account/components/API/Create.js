import CX from "classnames";
import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { mapValues } from "lodash";
import { Col, Modal, Row } from "react-bootstrap";

import APIPermissions from "./Permissions";
import { Button, Icon, Input, Flex, FlexItem } from "../../../base/index";
import { routerLocationHasState } from "../../../utils";

const getInitialState = (props) => ({
    name: "",
    permissions: mapValues(props.permissions, () => false),
    submitted: false,
    copied: false,
    key: ""
});

export class CreateAPIKey extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
    }

    modalExited = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = (e) => {
        e.preventDefault();

        this.setState({submitted: true}, () => {
            this.props.onCreate(this.state.name, this.state.permissions, (key) => this.setState({key}));
        });
    };

    handlePermissionChange = (key, value) => {
        this.setState({permissions: {...this.state.permissions, [key]: value}});
    };

    render () {
        let content;

        if (this.state.key) {
            content = (
                <Modal.Body className="text-center">
                    <Row>
                        <Col xs={12}>
                            <strong className="text-success">Here is your key.</strong>
                        </Col>
                    </Row>

                    <small>
                        Make note of it now. For security purposes, it will not be shown again.
                    </small>

                    <Row style={{marginTop: "10px", marginBottom: "5px"}}>
                        <Col xs={12} md={8} mdOffset={2}>
                            <Flex alignItems="stretch" alignContent="stretch">
                                <FlexItem grow={1}>
                                    <Input
                                        style={{marginBottom: 0}}
                                        formGroupStyle={{marginBottom: 0}}
                                        className="text-center"
                                        value={this.state.key} onChange={() => {}}
                                    />
                                </FlexItem>
                                <CopyToClipboard
                                    text={this.state.key}
                                    onCopy={() => this.setState({copied: true})}
                                >
                                    <Button icon="paste" bsStyle="primary" />
                                </CopyToClipboard>
                            </Flex>
                        </Col>
                    </Row>

                    <small className={CX("text-primary", {invisible: !this.state.copied})}>
                        <Icon name="checkmark" /> Copied
                    </small>
                </Modal.Body>
            );
        } else {
            content = (
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
                            label="Name"
                            value={this.state.name}
                            onChange={(e) => this.setState({name: e.target.value})}
                        />

                        <label>Permissions</label>

                        <APIPermissions
                            userPermissions={this.props.permissions}
                            keyPermissions={this.state.permissions}
                            onChange={this.handlePermissionChange}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button type="submit" icon="floppy" bsStyle="primary">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create API Key
                </Modal.Header>

                {content}
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    show: routerLocationHasState(state, "createAPIKey"),
    permissions: state.account.permissions
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(push({...window.location, state: {createAPIKey: false}}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CreateAPIKey);
