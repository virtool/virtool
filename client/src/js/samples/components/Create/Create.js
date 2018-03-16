import React from "react";
import { filter, map, replace, split, find, remove } from "lodash-es";
import { connect } from "react-redux";
import {
    Modal,
    Row,
    Col,
    ControlLabel,
    InputGroup
} from "react-bootstrap";
import { push } from "react-router-redux";

import ReadSelector from "./ReadSelector";
import { findReadyHosts, createSample } from "../../actions";
import { Button, Icon, InputError, LoadingPlaceholder } from "../../../base";
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
    errors: []
});

const SampleUserGroup = ({ group, groups, onChange }) => {
    const groupComponents = map(groups, groupId =>
        <option key={groupId} value={groupId} className="text-capitalize">
            {groupId}
        </option>
    );

    return (
        <Col md={3}>
            <InputError type="select" label="User Group" value={group} onChange={onChange}>
                <option key="none" value="none">None</option>
                {groupComponents}
            </InputError>
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
            return this.setState({subtraction: getReadyHosts(nextProps)});
        }

        const errors = [];

        if (!this.state.name) {
            this.setState({ error: "" });
        } else if (nextProps.errors && nextProps.errors.CREATE_SAMPLE_ERROR) {
            errors.push({
                id: 0,
                message: nextProps.errors.CREATE_SAMPLE_ERROR.message
            });
            this.setState({ errors });
        }
    }

    modalEnter = () => {
        this.props.onFindHosts();
        this.props.onFindFiles();
    };

    handleModalExited = () => {
        this.setState({
            selected: [],
            name: "",
            host: "",
            isolate: "",
            locale: "",
            group: this.props.forceGroupChoice ? "none" : "",
            errors: []
        });
    };

    handleSubmit = (e) => {
        e.preventDefault();

        const errors = [];

        if (!this.state.name) {
            errors.push({
                id: 0,
                message: "Required Field"
            });
        }

        if (!this.props.readyHosts || !this.props.readyHosts.length) {
            errors.push({
                id: 1,
                message: "A host genome must be added to Virtool before samples can be created and analyzed."
            });
        }

        if (!this.state.selected.length) {
            errors.push({
                id: 2,
                message: "At least one read file must be attached to the sample"
            });
        }

        if (errors.length) {
            this.setState({errors});
            return;
        }

        this.props.onCreate({...this.state, files: this.state.selected});
    };

    autofill = () => {
        this.setState({
            name: split(replace(this.state.selected[0], /[0-9a-z]{8}-/, ""), /_S\d+/)[0]
        });
    };

    handleSelect = (selected) => {
        const newErrors = this.state.errors;

        remove(newErrors, {id: 2});

        this.setState({selected, errors: newErrors});
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

        const userGroup = this.props.forceGroupChoice ? (
            <SampleUserGroup
                group={this.props.group}
                groups={this.props.groups}
                onChange={(e) => this.setState({group: e})}
            />
        ) : null;

        const libraryType = this.state.selected.length === 2 ? "Paired" : "Unpaired";

        const errorName = find(this.state.errors, ["id", 0]) ? find(this.state.errors, ["id", 0]).message : null;
        const errorHost = find(this.state.errors, ["id", 1]) ? find(this.state.errors, ["id", 1]).message : null;
        const errorFile = find(this.state.errors, ["id", 2]) ? find(this.state.errors, ["id", 2]).message : null;

        return (
            <Modal
                bsSize="large"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.modalEnter}
                onExited={this.handleModalExited}
            >
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Sample
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>

                        <Row>
                            <Col md={6}>
                                <ControlLabel>Sample Name</ControlLabel>
                                <InputGroup>
                                    <InputError
                                        name="sample name"
                                        value={this.state.name}
                                        onChange={(e) => this.setState({name: e.target.value, errors: []})}
                                        autocomplete={false}
                                        error={errorName}
                                    />
                                    <InputGroup.Button style={{verticalAlign: "top", zIndex: "0"}}>
                                        <Button
                                            type="button"
                                            onClick={this.autofill}
                                            disabled={!this.state.selected.length}
                                        >
                                            <Icon name="wand" />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </Col>
                            <Col md={6}>
                                <InputError
                                    label="Isolate"
                                    value={this.state.isolate}
                                    onChange={(e) => this.setState({isolate: e.target.value})}
                                />
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <InputError
                                    label="True Host"
                                    value={this.state.host}
                                    onChange={(e) => this.setState({host: e.target.value})}
                                />
                            </Col>
                            <Col md={6}>
                                <InputError
                                    type="select"
                                    label="Subtraction Host"
                                    value={this.state.subtraction}
                                    onChange={(e) => this.setState({subtraction: e.target.value, errors: []})}
                                    error={errorHost}
                                >
                                    {hostComponents}
                                </InputError>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <InputError
                                    label="Locale"
                                    value={this.state.locale}
                                    onChange={(e) => this.setState({locale: e.target.value})}
                                />
                            </Col>
                            {userGroup}
                            <Col md={6}>
                                <InputError
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
                            onSelect={this.handleSelect}
                            error={errorFile}
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
    const show = routerLocationHasState(state, "create", true);

    return {
        show,
        groups: state.account.groups,
        readyHosts: state.samples.readyHosts,
        readyReads: filter(state.files.documents, {type: "reads", reserved: false}),
        forceGroupChoice: state.settings.sample_group === "force_choice",
        errors: state.errors
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
