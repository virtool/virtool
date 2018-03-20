import React from "react";
import PropTypes from "prop-types";
import { includes } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem } from "../../../base";
import { getTaskDisplayName } from "../../../utils";

import TaskField from "./TaskField";

const readOnlyFields = ["create_subtraction", "rebuild_index"];

class Task extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            error: false
        };
    }

    componentWillReceiveProps (nextProps) {
        const { proc, mem, inst } = this.props;

        if (proc === nextProps.proc && mem === nextProps.mem && inst === nextProps.inst) {
            this.setState({ error: false });
        }
    }

    handleChangeLimit = (name, value) => {
        this.setState({ error: false });
        this.props.onChangeLimit(this.props.taskPrefix, name, value);
    };

    handleClearError = () => {
        this.setState({ error: false });
    };

    handleInvalid = () => {
        this.setState({ error: true });
    };

    render () {

        const { inst, mem, proc, taskPrefix, currentLimitProc, currentLimitMem } = this.props;

        const readOnly = includes(readOnlyFields, taskPrefix);

        const errorMessage = (
            <div className={this.state.error ? "input-form-error" : "input-form-error-none"}>
                <span className="input-error-message">
                    {this.state.error ? "Cannot go over or under resource limits" : "None"}
                </span>
            </div>
        );

        const procUpperLimit = currentLimitProc < proc ? currentLimitProc : proc;
        const memUpperLimit = currentLimitMem < mem ? currentLimitMem : mem;

        return (
            <ListGroupItem allowFocus className={this.state.error ? "list-group-item-danger" : ""}>
                <h5><strong>{getTaskDisplayName(taskPrefix)}</strong></h5>
                <Row>
                    <Col md={4}>
                        <TaskField
                            name="proc"
                            value={currentLimitProc < proc ? currentLimitProc : proc}
                            readOnly={readOnly}
                            onChange={this.handleChangeLimit}
                            clear={this.handleClearError}
                            lowerLimit={this.props.procLowerLimit}
                            upperLimit={procUpperLimit}
                            onInvalid={this.handleInvalid}
                        />
                    </Col>
                    <Col md={4}>
                        <TaskField
                            name="mem"
                            value={currentLimitMem < mem ? currentLimitMem : mem}
                            readOnly={readOnly}
                            onChange={this.handleChangeLimit}
                            clear={this.handleClearError}
                            lowerLimit={this.props.memLowerLimit}
                            upperLimit={memUpperLimit}
                            onInvalid={this.handleInvalid}
                        />
                    </Col>
                    <Col md={4}>
                        <TaskField
                            name="inst"
                            value={inst}
                            readOnly={taskPrefix === "rebuild_index"}
                            onChange={this.handleChangeLimit}
                            clear={this.handleClearError}
                            lowerLimit={1}
                            upperLimit={10}
                            onInvalid={this.handleInvalid}
                        />
                    </Col>
                    {errorMessage}
                </Row>
            </ListGroupItem>
        );
    }
}

Task.propTypes = {
    taskPrefix: PropTypes.string.isRequired,
    proc: PropTypes.number,
    mem: PropTypes.number,
    inst: PropTypes.number,
    onChangeLimit: PropTypes.func,
    procLowerLimit: PropTypes.number,
    memLowerLimit: PropTypes.number,
    currentLimitProc: PropTypes.number,
    currentLimitMem: PropTypes.number
};

export default Task;
