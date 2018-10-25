import React from "react";
import { filter, map, replace, split, get } from "lodash-es";
import { connect } from "react-redux";
import { Modal, Row, Col, ControlLabel, InputGroup } from "react-bootstrap";
import { push } from "react-router-redux";

import { findReadFiles, findReadyHosts, createSample } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button, Icon, InputError, LoadingPlaceholder, SaveButton } from "../../../base";
import { routerLocationHasState, getTargetChange } from "../../../utils";
import ReadSelector from "./ReadSelector";

const getReadyHosts = props => (props.readyHosts && props.readyHosts.length ? props.readyHosts[0].id || "" : "");

const getInitialState = props => ({
    selected: [],
    name: "",
    host: "",
    isolate: "",
    locale: "",
    srna: false,
    subtraction: getReadyHosts(props),
    group: props.forceGroupChoice ? "none" : "",
    errorName: "",
    errorSubtraction: "",
    errorFile: "",
    readyHosts: props.readyHosts
});

const SampleUserGroup = ({ group, groups, onChange }) => {
    const groupComponents = map(groups, groupId => (
        <option key={groupId} value={groupId} className="text-capitalize">
            {groupId}
        </option>
    ));

    return (
        <Col md={3}>
            <InputError type="select" label="User Group" value={group} onChange={onChange}>
                <option key="none" value="none">
                    None
                </option>
                {groupComponents}
            </InputError>
        </Col>
    );
};

class CreateSample extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.readyHosts !== prevState.readyHosts) {
            return {
                subtraction: getReadyHosts(nextProps),
                readyHosts: nextProps.readyHosts
            };
        }

        if (!prevState.errorName.length && !!nextProps.error) {
            return { errorName: nextProps.error };
        }

        return null;
    }

    componentDidMount() {
        this.props.onFindHosts();
        this.props.onFindFiles();
    }

    handleHide = () => {
        this.props.onHide();
    };

    handleModalExited = () => {
        this.setState(getInitialState(this.props));
        if (this.props.error.length) {
            this.props.onClearError("CREATE_SAMPLE_ERROR");
        }
    };

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name === "name" || name === "subtraction") {
            this.setState({ [name]: value, [error]: "" });
        } else {
            this.setState({ [name]: value });
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        let hasError = false;

        if (!this.state.name) {
            hasError = true;
            this.setState({ errorName: "Required Field" });
        }

        if (!this.props.readyHosts || !this.props.readyHosts.length) {
            hasError = true;
            this.setState({
                errorSubtraction: "A host genome must be added to Virtool before samples can be created and analyzed."
            });
        }

        if (!this.state.selected.length) {
            hasError = true;
            this.setState({
                errorFile: "At least one read file must be attached to the sample"
            });
        }

        if (!hasError) {
            this.props.onCreate({ ...this.state, files: this.state.selected });
        }
    };

    autofill = () => {
        this.setState({
            name: split(replace(this.state.selected[0], /[0-9a-z]{8}-/, ""), /_S\d+/)[0]
        });
    };

    handleSelect = selected => {
        this.setState({ selected, errorFile: "" });
    };

    render() {
        if (this.props.readyHosts === null) {
            return (
                <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
                    <Modal.Body>
                        <LoadingPlaceholder margin="36px" />
                    </Modal.Body>
                </Modal>
            );
        }

        const hostComponents = map(this.props.readyHosts, host => <option key={host.id}>{host.id}</option>);

        const userGroup = this.props.forceGroupChoice ? (
            <SampleUserGroup
                group={this.props.group}
                groups={this.props.groups}
                onChange={e => this.setState({ group: e })}
            />
        ) : null;

        const libraryType = this.state.selected.length === 2 ? "Paired" : "Unpaired";

        const { errorName, errorSubtraction, errorFile } = this.state;

        return (
            <Modal
                bsSize="large"
                show={this.props.show}
                onHide={this.handleHide}
                onEnter={this.modalEnter}
                onExited={this.handleModalExited}
            >
                <Modal.Header onHide={this.handleHide} closeButton>
                    Create Sample
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col xs={12}>
                                <ControlLabel>Sample Name</ControlLabel>
                                <InputGroup>
                                    <InputError
                                        name="name"
                                        value={this.state.name}
                                        onChange={this.handleChange}
                                        autocomplete={false}
                                        error={errorName}
                                    />
                                    <InputGroup.Button style={{ verticalAlign: "top", zIndex: "0" }}>
                                        <Button
                                            type="button"
                                            onClick={this.autofill}
                                            disabled={!this.state.selected.length}
                                        >
                                            <Icon name="magic" />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </Col>
                        </Row>

                        <Row>
                            <Col xs={12} md={6}>
                                <InputError
                                    name="isolate"
                                    label="Isolate"
                                    value={this.state.isolate}
                                    onChange={this.handleChange}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <InputError
                                    name="locale"
                                    label="Locale"
                                    value={this.state.locale}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>

                        <Row>
                            <Col xs={12} md={6}>
                                <InputError
                                    name="host"
                                    label="True Host"
                                    value={this.state.host}
                                    onChange={this.handleChange}
                                />
                            </Col>

                            <Col md={6}>
                                <InputError
                                    name="subtraction"
                                    type="select"
                                    label="Subtraction Host"
                                    value={this.state.subtraction}
                                    onChange={this.handleChange}
                                    error={errorSubtraction}
                                >
                                    {hostComponents}
                                </InputError>
                            </Col>
                        </Row>

                        <Row>
                            <Col xs={12} md={6}>
                                <InputError
                                    name="srna"
                                    type="select"
                                    label="Read Size"
                                    value={this.state.srna}
                                    onChange={this.handleChange}
                                >
                                    <option value={false}>Normal</option>
                                    <option value={true}>sRNA</option>
                                </InputError>
                            </Col>

                            {userGroup}
                            <Col xs={12} md={6}>
                                <InputError type="text" label="Library Type" value={libraryType} readOnly={true} />
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
                        <SaveButton />
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createSample"),
    groups: state.account.groups,
    readyHosts: state.samples.readyHosts,
    readyReads: filter(state.samples.readFiles, { reserved: false }),
    forceGroupChoice: state.settings.sample_group === "force_choice",
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onFindHosts: () => {
        dispatch(findReadyHosts());
    },

    onFindFiles: () => {
        dispatch(findReadFiles());
    },

    onCreate: ({ name, isolate, host, locale, srna, subtraction, files }) => {
        dispatch(createSample(name, isolate, host, locale, srna, subtraction, files));
    },

    onHide: () => {
        dispatch(push({ ...window.location, state: { create: false } }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CreateSample);
