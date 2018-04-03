import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel, Alert } from "react-bootstrap";
import { toNumber, upperFirst } from "lodash-es";

import { updateSetting } from "../../actions";
import { getResources } from "../../../jobs/actions";
import { InputError, LoadingPlaceholder, Icon} from "../../../base";

const getErrorMessage = (isError, min, max) => (
    isError ? `Value must be between ${min} and ${max}` : null
);

const getUpperLimits = (resources) => {
    const procLimit = resources.proc.length;
    const memLimit = parseFloat((resources.mem.total / Math.pow(1024, 3)).toFixed(1));

    return { procLimit, memLimit };
};

class Resources extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            errorProc: false,
            errorMem: false,
            showAlert: false
        };
    }

    componentDidMount () {
        this.props.onGet();
    }

    componentWillReceiveProps (nextProps) {

        if (nextProps.mem !== this.props.mem) {
            this.setState({errorMem: false});
        }

        if (nextProps.proc !== this.props.proc) {
            this.setState({errorProc: false});
        }
    }

    handleChange = (e) => {
        e.preventDefault();

        const error = `error${upperFirst(e.target.name)}`;
        this.setState({ [error]: false });
    };

    handleInvalid = (e) => {
        e.preventDefault();

        const error = `error${upperFirst(e.target.name)}`;
        this.setState({ [error]: true });
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

    render () {

        if (this.props.resources === null) {
            return <LoadingPlaceholder />;
        }

        const { procLimit, memLimit } = getUpperLimits(this.props.resources);

        const errorMessageProc = getErrorMessage(this.state.errorProc, this.props.procLowerLimit, procLimit);
        const errorMessageMem = getErrorMessage(this.state.errorMem, this.props.memLowerLimit, memLimit);

        const alert = this.props.error
            ? (
                <Alert bsStyle="danger">
                    <Icon name="warning" />
                    <span>
                        {" "}Resource Limit values cannot be lower than corresponding Task-specific Limits.
                    </span>
                </Alert>
            )
            : null;

        return (
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
                            <InputError
                                label="CPU Limit"
                                type="number"
                                name="proc"
                                min={this.props.procLowerLimit}
                                max={procLimit}
                                onSave={this.handleSave}
                                onInvalid={this.handleInvalid}
                                onChange={this.handleChange}
                                initialValue={
                                    procLimit < this.props.proc
                                        ? procLimit
                                        : this.props.proc
                                }
                                error={errorMessageProc}
                                noMargin
                                withButton
                            />
                            <InputError
                                label="Memory Limit (GB)"
                                type="number"
                                name="mem"
                                min={this.props.memLowerLimit}
                                max={memLimit}
                                step={0.1}
                                onSave={this.handleSave}
                                onInvalid={this.handleInvalid}
                                onChange={this.handleChange}
                                initialValue={
                                    memLimit < this.props.mem
                                        ? memLimit
                                        : this.props.mem
                                }
                                error={errorMessageMem}
                                noMargin
                                withButton
                            />
                        </Panel.Body>
                    </Panel>
                </Col>
            </Row>
        );
    }
}

const mapStateToProps = (state) => ({
    proc: state.settings.data.proc,
    mem: state.settings.data.mem,
    resources: state.jobs.resources,
    procLowerLimit: state.settings.data.rebuild_index_proc,
    memLowerLimit: state.settings.data.rebuild_index_mem,
    error: state.settings.data.updateError
});

const mapDispatchToProps = (dispatch) => ({

    onUpdate: (e) => {
        dispatch(updateSetting(e.name, toNumber(e.value)));
    },

    onGet: () => {
        dispatch(getResources());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Resources);
