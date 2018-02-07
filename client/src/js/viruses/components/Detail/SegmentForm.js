import React from "react";
import PropTypes from "prop-types";
import { map, toLower } from "lodash-es";
import { Row, Col } from "react-bootstrap";

import { formatIsolateName } from "../../../utils";
import { Input } from "../../../base";

export default class SegmentForm extends React.Component {

    changeSegName = (e) => {
        this.props.onChange({
            ...this.props.newEntry,
            name: e.target.value
        });
    }

    changeMolType = (e) => {
        this.props.onChange({
            ...this.props.newEntry,
            type: e.target.value
        });
    }

    render () {

        return (
            <form onSubmit={this.props.onSubmit}>
                <Row>
                    <Col md={12}>
                        <Input label="Segment Name" value={this.props.newEntry.name} onChange={(e) => {this.changeSegName(e)}} />
                    </Col>
                </Row>

                <Row>
                    <Col md={12}>
                        <Input type="select" label="Molecule Type" value={this.props.newEntry.type} onChange={(e) => {this.changeMolType(e)}}>
                            <option key="default" style={{display: "none"}} />
                            <option key="ssDNA" value="ssDNA">
                                ssDNA
                            </option>
                            <option key="dsDNA" value="dsDNA">
                                dsDNA
                            </option>
                            <option key="ssRNA+" value="ssRNA+">
                                ssRNA+
                            </option>
                            <option key="ssRNA-" value="ssRNA-">
                                ssRNA-
                            </option>
                            <option key="dsRNA" value="dsRNA">
                                dsRNA
                            </option>
                            <option key="ssRNA" value="ssRNA">
                                ssRNA
                            </option>
                        </Input>
                    </Col>
                </Row>
            </form>
        );
    }
}
