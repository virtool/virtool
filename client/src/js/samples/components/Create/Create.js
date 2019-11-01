import { push } from "connected-react-router";
import { filter, get, map, replace, split } from "lodash-es";
import React from "react";
import { Col, ControlLabel, InputGroup, Modal, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { Button, Icon, InputError, LoadingPlaceholder, SaveButton } from "../../../base";
import { clearError } from "../../../errors/actions";
import { listSubtractionIds } from "../../../subtraction/actions";
import { getTargetChange, routerLocationHasState } from "../../../utils/utils";

import { createSample, findReadFiles } from "../../actions";
import ReadSelector from "./ReadSelector";
import { SampleUserGroup } from "./UserGroup";

const getActiveSubtraction = props => get(props, ["subtractions", 0], "");

const getInitialState = props => ({
    selected: [],
    name: "",
    host: "",
    isolate: "",
    locale: "",
    srna: false,
    subtraction: getActiveSubtraction(props),
    group: props.forceGroupChoice ? "none" : "",
    errorName: "",
    errorSubtraction: "",
    errorFile: ""
});

class CreateSample extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.errorName.length && !!nextProps.error) {
            return { errorName: nextProps.error };
        }

        return null;
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
            this.setState({
                [name]: value,
                [error]: ""
            });
        } else {
            this.setState({
                [name]: value
            });
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        let hasError = false;

        if (!this.state.name) {
            hasError = true;
            this.setState({ errorName: "Required Field" });
        }

        if (!this.props.subtractions || !this.props.subtractions.length) {
            hasError = true;
            this.setState({
                errorSubtraction: "At least one subtraction must be added to Virtool before samples can be analyzed."
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
        if (this.props.subtractions === null || this.props.readyReads === null) {
            return (
                <Modal
                    bsSize="large"
                    show={this.props.show}
                    onHide={this.props.onHide}
                    onEnter={this.props.onLoadSubtractionsAndFiles}
                >
                    <Modal.Body>
                        <LoadingPlaceholder margin="36px" />
                    </Modal.Body>
                </Modal>
            );
        }

        const subtractionComponents = map(this.props.subtractions, subtractionId => (
            <option key={subtractionId} value={subtractionId}>
                {subtractionId}
            </option>
        ));

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
                onEnter={this.props.onLoadSubtractionsAndFiles}
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
                                    label="Host"
                                    value={this.state.host}
                                    onChange={this.handleChange}
                                />
                            </Col>

                            <Col md={6}>
                                <InputError
                                    name="subtraction"
                                    type="select"
                                    label="Default Subtraction"
                                    value={this.state.subtraction}
                                    onChange={this.handleChange}
                                    error={errorSubtraction}
                                >
                                    {subtractionComponents}
                                </InputError>
                            </Col>
                        </Row>

                        <Row>
                            <Col xs={12} sm={6}>
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
                            <Col xs={12} sm={6}>
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
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", ""),
    forceGroupChoice: state.settings.sample_group === "force_choice",
    groups: state.account.groups,
    readyReads: filter(state.samples.readFiles, { reserved: false }),
    show: routerLocationHasState(state, "createSample"),
    subtractions: state.subtraction.ids
});

const mapDispatchToProps = dispatch => ({
    onLoadSubtractionsAndFiles: () => {
        dispatch(listSubtractionIds());
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
