/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesImport
 *
 */

import React from "react";
import PropTypes from "prop-types";
import { filter } from "lodash";
import { connect } from "react-redux";
import {
    Alert,
    Modal,
    Row,
    Col,
    FormGroup,
    ControlLabel,
    FormControl,
    InputGroup
} from "react-bootstrap";

import { findReadyHosts, createSample } from "../../actions";
import { findFiles } from "../../../files/actions";
import { Button, Flex, FlexItem, Icon, Input, LoadingPlaceholder } from "../../../base";
import ReadSelector from "./ReadSelector";


const getReadyHosts = (props) => (
    props.readyHosts && props.readyHosts.length ? (props.readyHosts[0].id || "") : ""
);

const getInitialState = (props) => ({
    selected: [],
    name: "",
    host: "",
    isolate: "",
    locale: "",
    subtraction: getReadyHosts(props),
    group: props.forceGroupChoice ? "none" : "",
    error: null
});

class CreateSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
    }

    static propTypes = {
        show: PropTypes.bool,
        onHide: PropTypes.func,
        groups: PropTypes.array,
        readyReads: PropTypes.array,
        readFiles: PropTypes.arrayOf(PropTypes.object),
        readyHosts: PropTypes.arrayOf(PropTypes.object),
        onFindFiles: PropTypes.func,
        onFindHosts: PropTypes.func,
        onCreate: PropTypes.func
    };

    componentDidMount () {
        this.props.onFindHosts();
        this.props.onFindFiles();
    }

    componentWillReceiveProps (nextProps) {
        if (nextProps.readyHosts !== this.props.readyHosts) {
            this.setState({subtraction: getReadyHosts(nextProps)});
        }
    }

    modalEnter = () => {
        this.props.onFindHosts();
        this.props.onFindFiles();
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (!this.state.selected.length) {
            return this.setState({
                error: "At least one file must be selected."
            });
        }

        this.props.onCreate(
            this.state.name,
            this.state.isolate,
            this.state.host,
            this.state.locale,
            this.state.subtraction,
            this.state.selected
        );
    };

    autofill = () => {
        this.setState({
            name: this.state.selected[0].replace(/[0-9a-z]{8}-/, "").split(/_S\d+/)[0]
        });
    };

    render () {

        if (this.props.readyHosts === null || this.props.readFiles) {
            return (
                <Modal onEnter={this.modalEnter}>
                    <Modal.Body>
                        <LoadingPlaceholder margin="36px" />
                    </Modal.Body>
                </Modal>
            );
        }

        const hostComponents = this.props.readyHosts.map(host =>
            <option key={host.id}>{host.id}</option>
        );

        let noHostsAlert;

        if (!hostComponents.length) {
            noHostsAlert = (
                <Alert bsStyle="danger">
                    <Flex alignItems="center">
                        <Icon name="warning" />
                        <FlexItem pad={5}>
                            A host genome must be added to Virtool before samples can be created and analyzed.
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        let userGroup;

        if (this.state.forceGroupChoice) {

            const groupComponents = this.props.groups.map(groupId =>
                <option key={groupId} value={groupId} className="text-capitalize">
                    {groupId}
                </option>
            );

            userGroup = (
                <Col md={3}>
                    <Input type="select" label="User Group" value={this.state.group}>
                        <option key="none" value="none">None</option>
                        {groupComponents}
                    </Input>
                </Col>
            );
        }

        let alert;

        if (this.state.error) {
            alert = (
                <Alert bsStyle="danger">
                    <Icon name="warning" /> {this.state.error}
                </Alert>
            );
        }

        const libraryType = this.state.selected.length === 2 ? "Paired" : "Unpaired";

        return (
            <Modal bsSize="large" show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
                <Modal.Header onHide={this.hide} closeButton>
                    Create Sample
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        {noHostsAlert}

                        <Row>
                            <Col md={9}>
                                <FormGroup>
                                    <ControlLabel>
                                        Sample Name
                                    </ControlLabel>
                                    <InputGroup>
                                        <FormControl
                                            type="text"
                                            value={this.state.name}
                                            onChange={(e) => this.setState({name: e.target.value})}
                                            autoComplete={false}

                                        />
                                        <InputGroup.Button>
                                            <Button
                                                type="button"
                                                onClick={this.autofill}
                                                disabled={!this.state.selected.length}
                                            >
                                                <Icon name="wand" />
                                            </Button>
                                        </InputGroup.Button>
                                    </InputGroup>
                                </FormGroup>
                            </Col>
                            <Col md={3}>
                                <Input
                                    label="Isolate"
                                    value={this.state.isolate}
                                    onChange={(e) => this.setState({isolate: e.target.value})}
                                />
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Input
                                    label="True Host"
                                    value={this.state.host}
                                    onChange={(e) => this.setState({host: e.target.value})}
                                />
                            </Col>
                            <Col md={6}>
                                <Input
                                    label="Subtraction Host"
                                    value={this.state.subtraction}
                                    onChange={(e) => this.setState({subtraction: e.target.value})}
                                >
                                    {hostComponents}
                                </Input>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={this.state.forceGroupChoice ? 6 : 8}>
                                <Input
                                    label="Locale"
                                    value={this.state.locale}
                                    onChange={(e) => this.setState({locale: e.target.value})}
                                />
                            </Col>
                            {userGroup}
                            <Col md={this.state.forceGroupChoice ? 3 : 4}>
                                <Input
                                    type="text"
                                    label="Library Type"
                                    value={libraryType}
                                    readOnly={true}
                                />
                            </Col>
                        </Row>

                        <ReadSelector
                            files={this.props.readyReads}
                            selected={this.state.selected}
                            onSelect={(selected) => this.setState({selected})}
                        />

                        {alert}
                    </Modal.Body>

                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary">
                            <Icon name="floppy" /> Save
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    groups: state.account.groups,
    readyHosts: state.samples.readyHosts,
    readyReads: filter(state.files.documents, {type: "reads", reserved: false}),
    forceGroupChoice: state.settings.sample_group === "force_choice"
});

const mapDispatchToProps = (dispatch) => ({

    onFindHosts: () => {
        dispatch(findReadyHosts());
    },

    onFindFiles: () => {
        dispatch(findFiles());
    },

    onCreate: (name, isolate, host, locale, subtraction, files) => {
        dispatch(createSample(name, isolate, host, locale, subtraction, files));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(CreateSample);

export default Container;
