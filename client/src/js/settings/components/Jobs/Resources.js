import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { toNumber } from "lodash-es";

import { updateSetting } from "../../actions";
import { getResources } from "../../../jobs/actions";
import { InputError, LoadingPlaceholder } from "../../../base";

class Resources extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            errorProc: false,
            errorMem: false
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

    handleInvalidProc = (e) => {
        e.preventDefault();
        this.setState({errorProc: true});
    };

    handleInvalidMem = (e) => {
        e.preventDefault();
        this.setState({errorMem: true});
    };

    render () {
        if (this.props.resources === null) {
            return <LoadingPlaceholder />;
        }

        const memLimit = parseFloat((this.props.resources.mem.total / Math.pow(1024, 3)).toFixed(1));
        const procLimit = this.props.resources.proc.length;

        const errorMessageProc = this.state.errorProc ? "Cannot exceed resource limits" : null;
        const errorMessageMem = this.state.errorMem ? "Cannot exceed resource limits" : null;

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
                            max={procLimit}
                            onSave={this.props.onUpdateProc}
                            onInvalid={this.handleInvalidProc}
                            initialValue={this.props.proc}
                            error={errorMessageProc}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="Memory Limit (GB)"
                            type="number"
                            min={this.props.memLowerLimit}
                            max={memLimit}
                            step={0.1}
                            onSave={this.props.onUpdateMem}
                            onInvalid={this.handleInvalidMem}
                            initialValue={this.props.mem}
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
