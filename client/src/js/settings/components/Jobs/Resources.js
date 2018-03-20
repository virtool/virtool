import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { toNumber } from "lodash-es";

import { updateSetting } from "../../actions";
import { getResources } from "../../../jobs/actions";
import { InputError, LoadingPlaceholder} from "../../../base";

class Resources extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            errorProc: false,
            errorMem: false,
            procUpperLimit: this.props.proc,
            memUpperLimit: this.props.mem
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

        if (nextProps.resources) {
            this.setState({
                memUpperLimit: parseFloat((nextProps.resources.mem.total / Math.pow(1024, 3)).toFixed(1)),
                procUpperLimit: nextProps.resources.proc.length
            });
        }
    }

    handleChangeProc = (e) => {
        e.preventDefault();
        this.setState({ errorProc: false });
    };

    handleChangeMem = (e) => {
        e.preventDefault();
        this.setState({ errorMem: false });
    };

    handleInvalidProc = (e) => {
        e.preventDefault();
        this.setState({ errorProc: true });
    };

    handleInvalidMem = (e) => {
        e.preventDefault();
        this.setState({ errorMem: true });
    };

    handleSaveProc = (e) => {
        if (e.value <= this.state.procUpperLimit && e.value >= this.props.procLowerLimit) {
            this.props.onUpdateProc(e);
        } else {
            this.setState({ errorProc: true });
        }
    };

    handleSaveMem = (e) => {
        if (e.value <= this.state.memUpperLimit && e.value >= this.props.memLowerLimit) {
            this.props.onUpdateMem(e);
        } else {
            this.setState({ errorMem: true });
        }
    };

    render () {
        if (this.props.resources === null) {
            return <LoadingPlaceholder />;
        }

        const errorMessageProc = this.state.errorProc ? "Cannot go over or under resource limits" : null;
        const errorMessageMem = this.state.errorMem ? "Cannot go over or under resource limits" : null;

        return (
            <Row>
                <Col md={12}>
                    <h5><strong>Resource Limits</strong></h5>
                </Col>
                <Col xs={12} md={6} mdPush={6}>
                    <Panel>
                        Set limits on the computing resources Virtool can use on the host server.
                    </Panel>
                </Col>
                <Col xs={12} md={6} mdPull={6}>
                    <Panel>
                        <InputError
                            label="CPU Limit"
                            type="number"
                            min={this.props.procLowerLimit}
                            max={this.state.procUpperLimit}
                            onSave={this.handleSaveProc}
                            onInvalid={this.handleInvalidProc}
                            onChange={this.handleChangeProc}
                            initialValue={
                                this.props.proc > this.state.procUpperLimit
                                    ? this.state.procUpperLimit
                                    : this.props.proc
                            }
                            error={errorMessageProc}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="Memory Limit (GB)"
                            type="number"
                            min={this.props.memLowerLimit}
                            max={this.state.memUpperLimit}
                            step={0.1}
                            onSave={this.handleSaveMem}
                            onInvalid={this.handleInvalidMem}
                            onChange={this.handleChangeMem}
                            initialValue={
                                this.props.mem > this.state.memUpperLimit
                                    ? this.state.memUpperLimit
                                    : this.props.mem
                            }
                            error={errorMessageMem}
                            noMargin
                            withButton
                        />
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
    memLowerLimit: state.settings.data.rebuild_index_mem
});

const mapDispatchToProps = (dispatch) => ({

    onUpdateProc: (e) => {
        dispatch(updateSetting("proc", toNumber(e.value)));
    },

    onUpdateMem: (e) => {
        dispatch(updateSetting("mem", toNumber(e.value)));
    },

    onGet: () => {
        dispatch(getResources());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Resources);
