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

import React, { PropTypes } from "react";
import { filter } from "lodash";
import { connect } from "react-redux";
import { capitalize } from "lodash";
import {
    Alert,
    Modal,
    Row,
    Col,
    Overlay,
    Popover,
    FormGroup,
    ControlLabel,
    FormControl,
    InputGroup
} from "react-bootstrap";

import { findReadyHosts } from "../../actions";
import { findFiles } from "../../../files/actions";
import { Flex, FlexItem, Icon, Input, Button } from "virtool/js/components/Base";
import ReadSelector from "./ReadSelector";


const getReadyHosts = (props) => {
    return props.readyHosts && props.readyHosts.length ? (props.readyHosts[0].id || ""): "";
};

const getInitialState = (props) => {
    return {
        selected: [],
        name: "",
        host: "",
        isolate: "",
        locale: "",
        subtraction: getReadyHosts(props),
        group: props.forceGroupChoice ? "none": ""
    };
};

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
            this.setState({
                subtraction: getReadyHosts(nextProps),
            });
        }
    }

    modalEnter = () => {
        this.props.onFindHosts();
        this.props.onFindFiles();
    };

    handleSubmit = (event) => {
        event.preventDefault();

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
                        <div className="text-center">
                            Loading
                        </div>
                    </Modal.Body>
                </Modal>
            )
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
                <option key={groupId} value={groupId}>
                    {capitalize(groupId)}
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

        let errors = [];

        if (this.state.nameExistsError) {
            errors.push("Sample name already exists");
        }

        if (this.state.nameEmptyError) {
            errors.push("The name field cannot be empty");
        }

        let overlay;

        if (errors.length > 0) {

            const errorComponents = errors.map((error, index) =>
                <div key={index} className="text-danger">{error}</div>
            );

            overlay = (
                <Overlay
                    show={true}
                    placement="top"
                    container={this}
                    target={this.nameNode}
                >
                    <Popover id="name-warning-popover">
                        <div>
                            {errorComponents}
                        </div>
                    </Popover>
                </Overlay>
            );
        }

        const libraryType = this.state.selected.length === 2 ? "Paired": "Unpaired";

        return (
            <Modal bsSize="large" show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
                <Modal.Header onHide={this.hide} closeButton>
                    Create Sample
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        {noHostsAlert}

                        <Row>
                            {overlay}
                            <Col md={9}>
                                <FormGroup>
                                    <ControlLabel>
                                        Sample Name
                                    </ControlLabel>
                                    <InputGroup>
                                        <FormControl
                                            type="text"
                                            name="name"
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
                                    type="text"
                                    name="isolate"
                                    label="Isolate"
                                    value={this.state.isolate}
                                    onChange={(e) => this.setState({isolate: e.target.value})}
                                />
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Input
                                    type="text"
                                    name="host"
                                    label="True Host"
                                    value={this.state.host}
                                    onChange={(e) => this.setState({host: e.target.value})}
                                />
                            </Col>
                            <Col md={6}>
                                <Input
                                    name="subtraction"
                                    type="select"
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
                                    type="text"
                                    name="locale"
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
                            onSelect={(selected) => this.setState({selected: selected})}
                        />

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

const mapStateToProps = (state) => {
    return {
        groups: state.account.groups,
        readyHosts: state.samples.readyHosts,
        readyReads: filter(state.files.documents, {type: "reads"}),
        forceGroupChoice: state.settings.sample_group === "force_choice"
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFindHosts: () => {
            dispatch(findReadyHosts());
        },

        onFindFiles: () => {
            dispatch(findFiles());
        },

        onCreate: (name, isolate, host, locale, subtraction, selected) => {
            window.console.log(name, isolate, host, locale, subtraction, selected);
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(CreateSample);

export default Container;
