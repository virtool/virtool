import React from "react";
import { filter, map, replace, split } from "lodash-es";
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
import { push } from "react-router-redux";

import ReadSelector from "./ReadSelector";
import { findReadyHosts, createSample } from "../../actions";
import { Button, Icon, Input, LoadingPlaceholder } from "../../../base";
import { findFiles } from "../../../files/actions";
import { routerLocationHasState } from "../../../utils";

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

const SampleUserGroup = ({ group, groups, onChange }) => {
    const groupComponents = map(groups, groupId =>
        <option key={groupId} value={groupId} className="text-capitalize">
            {groupId}
        </option>
    );

    return (
        <Col md={3}>
            <Input type="select" label="User Group" value={group} onChange={onChange}>
                <option key="none" value="none">None</option>
                {groupComponents}
            </Input>
        </Col>
    );
};

class CreateSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
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

        this.props.onCreate({...this.state, files: this.state.selected});
    };

    autofill = () => {
        this.setState({
            name: split(replace(this.state.selected[0], /[0-9a-z]{8}-/, ""), /_S\d+/)[0]
        });
    };

    render () {

        if (this.props.readyHosts === null || this.props.readFiles) {
            return (
                <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
                    <Modal.Body>
                        <LoadingPlaceholder margin="36px" />
                    </Modal.Body>
                </Modal>
            );
        }

        const hostComponents = map(this.props.readyHosts, host =>
            <option key={host.id}>{host.id}</option>
        );

        let noHostsAlert;

        if (!hostComponents.length) {
            noHostsAlert = (
                <Alert bsStyle="danger">
                    <Icon name="warning" /> A host genome must be added to Virtool before samples can be created and
                    analyzed.
                </Alert>
            );
        }

        const userGroup = this.props.forceGroupChoice ? (
            <SampleUserGroup
                group={this.props.group}
                groups={this.props.groups}
                onChange={(e) => this.setState({group: e})}
            />
        ) : null;

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
                <Modal.Header onHide={this.props.onHide} closeButton>
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

const mapStateToProps = (state) => {
    const show = routerLocationHasState(state, "create", true);

    return {
        show,
        groups: state.account.groups,
        readyHosts: state.samples.readyHosts,
        readyReads: filter(state.files.documents, {type: "reads", reserved: false}),
        forceGroupChoice: state.settings.sample_group === "force_choice"
    };
};

const mapDispatchToProps = (dispatch) => ({

    onFindHosts: () => {
        dispatch(findReadyHosts());
    },

    onFindFiles: () => {
        dispatch(findFiles("reads", 1));
    },

    onCreate: ({ name, isolate, host, locale, subtraction, files }) => {
        dispatch(createSample(name, isolate, host, locale, subtraction, files));
    },

    onHide: () => {
        dispatch(push({...window.location, state: {create: false}}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CreateSample);
