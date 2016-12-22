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

"use strict";

import React from "react";
import {pick, assign, capitalize} from "lodash";
import {Row, Col, Alert} from "react-bootstrap";
import Icon from "virtool/js/components/Base/Icon.jsx";
import Modal from "virtool/js/components/Base/Modal.jsx";
import Input from "virtool/js/components/Base/Input.jsx";
import Button from "virtool/js/components/Base/PushButton.jsx";
import ReadSelector from "./ReadSelector.jsx";

function getInitialState () {

    const readyHosts = dispatcher.db.hosts.find({added: true});

    return {
        selected: [],

        name: "",
        host: "",
        isolate: "",
        locale: "",
        subtraction: readyHosts.length > 0 ? readyHosts[0]._id: null,

        forceGroupChoice: getForceGroupChoice(),
        group: dispatcher.settings.get("sample_group") == "force_choice" ? "none": "",

        nameExistsError: false,
        nameEmptyError: false,
        readError: false,

        pending: false
    };

}

function getForceGroupChoice () {
    return dispatcher.settings.get("sample_group") == "force_choice"
}

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
export default class CreateSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    };

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    modalEntered = () => {
        dispatcher.settings.on("change", this.onSettingsChange);

        if (dispatcher.db.hosts.count({added: true}) > 0) {
            this.refs.name.focus();
        }
    };

    modalWillExit = () => {
        dispatcher.settings.off("change", this.onSettingsChange);
        this.setState(getInitialState);
    };

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    onSettingsChange = () => {
        this.setState({forceGroupChoice: getForceGroupChoice ()});
    };

    select = (selected) => {
        this.setState({
            selected: selected
        });
    };

    /**
     * Send a request to the server
     *
     * @param event {object} - the submit event
     */
    handleSubmit = (event) => {

        event.preventDefault();

        let data = pick(this.state, );

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
                    .success(() => {
                        this.setState(getInitialState());
                    })
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

        let modalBody;

        if (dispatcher.db.hosts.count({added: true}) === 0) {
            modalBody = (
                <Modal.Body>
                    <Alert bsStyle="warning" className="text-center">
                        <Icon name="notification" />
                        <span> A host genome must be added to Virtool before samples can be created and analyzed.</span>
                    </Alert>
                </Modal.Body>
            );
        } else {

            const hostComponents = dispatcher.db.hosts.find({added: true}).map(host => {
                return <option key={host._id}>{host._id}</option>;
            });

            let userGroup;

            if (this.state.forceGroupChoice) {

                const userGroupComponents = dispatcher.user.groups.map(groupId => {
                    return <option key={groupId} value={groupId}>{_.capitalize(groupId)}</option>
                });

                userGroup = (
                    <Col md={3}>
                        <Input type="select" label="User Group" value={this.state.group}>
                            <option key="none" value="none">None</option>
                            {userGroupComponents}
                        </Input>
                    </Col>
                );
            }

            let error;

            if (this.state.nameExistsError) {
                error = "Sample name already exists. Choose another."
            }

            if (this.state.nameEmptyError) {
                error = "The name field cannot be empty."
            }

            const libraryType = this.state.selected.length === 2 ? "Paired": "Unpaired";

            modalBody = (
                <div>
                    <Modal.Progress active={this.state.pending} />

                    <form onSubmit={this.handleSubmit}>
                        <Modal.Body>
                            <Row ref="nameRow">
                                <Col md={9}>
                                    <Input
                                        ref="name"
                                        name="name"
                                        type="text"
                                        error={error ? <span className="text-danger">{error}</span> : null}
                                        value={this.state.name}
                                        onChange={this.handleChange}
                                        label="Sample Name"
                                        autoComplete={false}
                                    />
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

                            <Row ref="hostSubtractionRow">
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
                                    <Input name="subtraction" type="select" label="Subtraction Host" value={this.state.subtraction} onChange={this.handleChange}>
                                        {hostComponents}
                                    </Input>
                                </Col>
                            </Row>

                            <Row ref="localeLibraryRow">
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
                                ref="reads"
                                {...this.state}
                                select={this.select}
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

        return (
            <Modal dialogClassName="modal-lg" show={this.props.show} onHide={this.props.onHide} onEntered={this.modalEntered} onExit={this.modalWillExit}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Sample
                </Modal.Header>

                {modalBody}
            </Modal>
        );
    }
}