/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobDetail
 */

import React from "react";
import { last } from "lodash";
import { Modal } from "react-bootstrap";

import ProgressTable from "./ProgressTable";
import General from "./General";
import Error from "./Error";

const JobDetail = (props) => {

    const data = props.detail;

    // The error will be included in the last status update of a failed job. If undefined, no error message will be
    // displayed.
    const error = last(data.status).error;

    return (
        <div>
            <Modal.Header onHide={props.onHide} closeButton>
                Job {props.detail._id.toUpperCase()}
            </Modal.Header>
            <Modal.Body>
                <General {...data} />
                {error ? <Error error={error} />: null}
                <ProgressTable status={data.status} log={data.log} />
            </Modal.Body>
        </div>
    );
};

JobDetail.propTypes = {
    detail: React.PropTypes.object,
    onHide: React.PropTypes.func
};

export default JobDetail;
