/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddVirus
 */

import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Row, Col, Modal, Alert, ButtonToolbar } from "react-bootstrap";

import { Icon, Flex, FlexItem, Input, Button } from "virtool/js/components/Base";
import { createVirus } from "../actions";

/**
 * A form for adding a new virus, defining its name and abbreviation.
 */
class CreateVirus extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            name: "",
            abbreviation: ""
        };
    }

    componentDidMount () {
        this.inputNode.focus();
    }

    modalExited = () => {
        this.setState({
            name: "",
            abbreviation: ""
        });
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onSubmit(this.state.name, this.state.abbreviation);
    };

    render () {

        let alert;

        if (this.props.error) {
            alert = (
                <Alert bsStyle="danger">
                    <Flex>
                        <FlexItem grow={0} shrink={0}>
                            <Icon name="warning" />
                        </FlexItem>
                        <FlexItem grow={1} shrink={0} pad>
                            {this.props.error}
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        const inputProps = {
            type: "text",
            onChange: this.handleChange
        };

        return (
            <Modal show={true} onHide={this.props.onHide} onExited={this.modalExited} animation={false}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Virus
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col md={9}>
                                <Input
                                    {...inputProps}
                                    ref={(node) => this.inputNode = node}
                                    label="Name"
                                    value={this.state.name}
                                    onChange={(e) => this.setState({name: e.target.value})}
                                />
                            </Col>
                            <Col md={3}>
                                <Input
                                    {...inputProps}
                                    label="Abbreviation"
                                    value={this.state.abbreviation}
                                    onChange={(e) => this.setState({abbreviation: e.target.value})}
                                />
                            </Col>
                        </Row>

                        {alert}
                    </Modal.Body>

                    <Modal.Footer>
                        <ButtonToolbar className="pull-right">
                            <Button icon="floppy" type="submit" bsStyle="primary">
                                Save
                            </Button>
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        error: state.viruses.createError,
        pending: state.viruses.createPending
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {

        onSubmit: (name, abbreviation) => {
            dispatch(createVirus(name, abbreviation))
        },

        onHide: () => {
            ownProps.history.push("/viruses");
        }
    };
};

const CreateVirusContainer = withRouter(connect(
    mapStateToProps,
    mapDispatchToProps
)(CreateVirus));

export default CreateVirusContainer;

