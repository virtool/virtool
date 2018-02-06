import React from "react";
import PropTypes from "prop-types";
import { map, toLower } from "lodash-es";
import { Row, Col } from "react-bootstrap";

import { formatIsolateName } from "../../../utils";
import { Input } from "../../../base";

export default class SegmentForm extends React.Component {
/*
    static propTypes = {
        sourceType: PropTypes.string,
        sourceName: PropTypes.string,
        allowedSourceTypes: PropTypes.arrayOf(PropTypes.string),
        restrictSourceTypes: PropTypes.bool,
        onChange: PropTypes.func,
        onSubmit: PropTypes.func
    };

    changeSourceType = (e) => {
        this.props.onChange({
            sourceType: toLower(e.target.value),
            sourceName: e.target.value === "unknown" ? "" : this.props.sourceName
        });
    };

    changeSourceName = (e) => {
        this.props.onChange({
            sourceName: e.target.value,
            sourceType: this.props.sourceType
        });
    };
*/
    render () {

        return (
            <form onSubmit={this.props.onSubmit}>
                <Row>
                    <Col md={12}>
                        <Input placeholder="segment name" />
                    </Col>
                </Row>
            </form>
        );
    }
}
