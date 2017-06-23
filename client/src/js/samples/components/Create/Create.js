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
import { connect } from "react-redux";
import { Row, Col, Overlay, Popover, FormGroup, ControlLabel, FormControl, InputGroup } from "react-bootstrap";
import { capitalize, pick, assign } from "lodash";
import { Icon, Input, Button } from "virtool/js/components/Base";

import ReadSelector from "./ReadSelector";

const getInitialState = () => {
    return {
        selected: [],
        name: "",
        host: "",
        isolate: "",
        locale: "",
        readyHosts: readyHosts,
        subtraction: readyHosts.length > 0 ? readyHosts[0]._id: null,
        forceGroupChoice: getForceGroupChoice(),
        group: dispatcher.settings.get("sample_group") == "force_choice" ? "none": "",
        nameExistsError: false,
        nameEmptyError: false,
        readError: false,
        pending: false
    };
};

const getForceGroupChoice = () => dispatcher.settings.get("sample_group") == "force_choice";

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
export default class CreateSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    componentDidMount () {
        this.props.onFindHosts();
    }

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    autofill = () => {
        this.setState({
            name: this.state.selected[0].replace(/[0-9a-z]{8}-/, "").split(/_S\d+/)[0]
        });
    };

    onSettingsChange = () => this.setState({forceGroupChoice: getForceGroupChoice()});

    /**
     * Send a request to the server
     *
     * @param event {object} - the submit event
     */
    handleSubmit = (event) => {

        event.preventDefault();

        let data = pick(this.state, [
            "name",
            "host",
            "isolate",
            "locale",
            "subtraction",
            "group"
        ]);

        assign(data, {
            files: this.state.selected,
            paired: this.state.selected.length == 2
        });

        const nameEmptyError = !data.name;

        const nameExistsError = dispatcher.db.samples.count({name: data.name}) > 0;

        const readError = data.files.length === 0;

        if (readError || nameEmptyError || nameExistsError) {
            this.setState({
                readError: readError,
                nameEmptyError: nameEmptyError,
                nameExistsError: nameExistsError
            });
        } else {
            // Send the request to the server.
            this.setState({pending: true}, () => {
                dispatcher.db.samples.request("new", data)
                    .success(() => this.setState(getInitialState()))
                    .failure(() => {
                        this.setState({
                            nameExistsError: true,
                            pending: false
                        });
                    });
            });
        }
    };

    render () {



        if (this.state.readyHosts.length === 0) {
            modalBody = (
                <Modal.Body>
                        <Icon name="notification" />
                        <span> A host genome must be added to Virtool before samples can be created and analyzed.</span>
                </Modal.Body>
            );
        } else {
            const hostComponents = this.state.readyHosts.map(host =>
                <option key={host._id}>{host._id}</option>
            );

            let userGroup;

            if (this.state.forceGroupChoice) {

                const userGroupComponents = dispatcher.user.groups.map(groupId =>
                    <option key={groupId} value={groupId}>{capitalize(groupId)}</option>
                );

                userGroup = (
                    <Col md={3}>
                        <Input type="select" label="User Group" value={this.state.group}>
                            <option key="none" value="none">None</option>
                            {userGroupComponents}
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

            modalBody = (
                <div>
                    <AutoProgressBar active={this.state.pending} affixed />

                    <form onSubmit={this.handleSubmit}>
                        <Modal.Body>
                            <Row>
                                {overlay}
                                <Col md={9}>
                                    <FormGroup>
                                        <ControlLabel>
                                            Sample Name
                                        </ControlLabel>
                                        <InputGroup>
                                            <FormControl
                                                inputRef={(node) => this.nameNode = node}
                                                type="text"
                                                name="name"
                                                value={this.state.name}
                                                onChange={this.handleChange}
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
                                        onChange={this.handleChange}
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
                                        onChange={this.handleChange}
                                    />
                                </Col>
                                <Col md={6}>
                                    <Input
                                        name="subtraction"
                                        type="select"
                                        label="Subtraction Host"
                                        value={this.state.subtraction}
                                        onChange={this.handleChange}
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
                                        onChange={this.handleChange}
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
                                {...this.state}
                                select={(selected) => {this.setState({selected: selected})}}
                            />
                        </Modal.Body>

                        <Modal.Footer>
                            <Button type="submit" bsStyle="primary">
                                <Icon name="floppy" /> Save
                            </Button>
                        </Modal.Footer>
                    </form>
                </div>
            );
        }
    }
}

const mapStateToProps = (props) => {

};
