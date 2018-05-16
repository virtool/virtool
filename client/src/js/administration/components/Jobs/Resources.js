import React from "react";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";
import { toNumber, upperFirst } from "lodash-es";

import { Alert, Flex, FlexItem, InputError, LoadingPlaceholder } from "../../../base";
import { getResources } from "../../../jobs/actions";
import { maxResourcesSelector, minResourcesSelector } from "../../selectors";
import { updateSetting } from "../../actions";

const getErrorMessage = (isError, min, max) => (
    isError ? `Value must be between ${min} and ${max}` : null
);

const LimitLabel = ({ label, available, unit }) => (
    <h5>
        <Flex alignItems="center">
            <FlexItem grow={1} shrink={0}>
                <strong>{label}</strong>
            </FlexItem>
            <FlexItem grow={0} shrink={0}>
                <small className="text-info">
                    {available} {unit} available
                </small>
            </FlexItem>
        </Flex>
    </h5>
);

class Resources extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            mem: this.props.mem,
            proc: this.props.proc,
            errorProc: false,
            errorMem: false,
            showAlert: false
        };
    }

    componentDidMount () {
        this.props.onGet();
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        if (nextProps.mem !== prevState.mem) {
            return { errorMem: false };
        }

        if (nextProps.proc !== prevState.proc) {
            return { errorProc: false };
        }

        return null;
    }

    handleChange = (e) => {
        this.setError(e, false);
    };

    handleInvalid = (e) => {
        this.setError(e, true);
    };

    handleSave = (e) => {
        const name = e.name;
        const value = toNumber(e.value);
        const error = `error${upperFirst(name)}`;

        if (value <= e.max && value >= e.min) {
            this.props.onUpdate(e);
        } else {
            this.setState({ [error]: true });
        }
    };

    setError = (e, value) => {
        e.preventDefault();

        this.setState({
            [`error${upperFirst(e.target.name)}`]: value
        });
    };

    render () {

        if (this.props.resources === null) {
            return <LoadingPlaceholder />;
        }

        const errorMessageProc = getErrorMessage(
            this.state.errorProc,
            this.props.minProc,
            this.props.maxProc
        );

        const errorMessageMem = getErrorMessage(
            this.state.errorMem,
            this.props.minMem,
            this.props.maxMem
        );

        let alert;

        if (this.props.error) {
            alert = (
                <Alert bsStyle="danger" icon="warning">
                    Resource Limit values cannot be lower than corresponding Task-specific Limits.
                </Alert>
            );
        }

        return (
            <div>
                {alert}
                <Row>
                    <Col md={12}>
                        <h5><strong>Resource Limits</strong></h5>
                    </Col>
                    <Col xs={12} md={6} mdPush={6}>
                        <Panel>
                            <Panel.Body>
                                Set limits on the computing resources Virtool can use on the host server.
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col xs={12} md={6} mdPull={6}>
                        <Panel>
                            <Panel.Body>
                                <LimitLabel label="CPU Limit" available={this.props.maxProc} unit="cores" />
                                <InputError
                                    type="number"
                                    name="proc"
                                    min={this.props.minProc}
                                    max={this.props.maxProc}
                                    onSave={this.handleSave}
                                    onInvalid={this.handleInvalid}
                                    onChange={this.handleChange}
                                    initialValue={this.props.proc}
                                    error={errorMessageProc}
                                    noMargin
                                    withButton
                                />

                                <LimitLabel label="Memory Limit (GB)" available={this.props.maxMem} unit="GB" />
                                <InputError
                                    type="number"
                                    name="mem"
                                    min={this.props.minMem}
                                    max={this.props.maxMem}
                                    onSave={this.handleSave}
                                    onInvalid={this.handleInvalid}
                                    onChange={this.handleChange}
                                    initialValue={this.props.mem}
                                    error={errorMessageMem}
                                    noMargin
                                    withButton
                                />
                            </Panel.Body>
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { maxProc, maxMem } = maxResourcesSelector(state);
    const { minProc, minMem } = minResourcesSelector(state);

    return {
        proc: state.settings.data.proc,
        mem: state.settings.data.mem,
        minProc,
        minMem,
        maxProc,
        maxMem,
        resources: state.jobs.resources,
        error: state.settings.data.updateError
    };
};

const mapDispatchToProps = (dispatch) => ({

    onUpdate: (e) => {
        dispatch(updateSetting(e.name, toNumber(e.value)));
    },

    onGet: () => {
        dispatch(getResources());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Resources);
