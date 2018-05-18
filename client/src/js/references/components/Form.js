import React from "react";
import { map } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { InputError, Checkbox } from "../../base";

export default class ReferenceForm extends React.Component {

    render () {

        const acceptedDataTypes = [
            "",
            "genome"
        ];

        const dataOptions = map(acceptedDataTypes, (type) =>
            <option key={type} value={type} className="text-capitalize">
                {type || "None"}
            </option>
        );

        let extraComponent;

        if (this.props.state.errorFileNumber != null) {
            extraComponent = (
                <Col xs={6}>
                    <div className="input-form-error">
                        <span className="input-error-message" style={{ margin: "0 0 0 0" }}>
                            {this.props.state.errorFileNumber}
                        </span>
                    </div>
                </Col>
            );
        }

        return (
            <div>
                <Row>
                    <Col xs={12}>
                        <InputError
                            label="Name"
                            name="name"
                            value={this.props.state.name}
                            onChange={this.props.onChange}
                            error={this.props.state.errorName}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col xs={12}>
                        <InputError
                            label="Description"
                            type="textarea"
                            name="description"
                            value={this.props.state.description}
                            onChange={this.props.onChange}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col xs={12} md={6}>
                        <InputError
                            label="Data Type"
                            name="dataType"
                            type="select"
                            value={this.props.state.dataType}
                            onChange={this.props.onChange}
                            error={this.props.state.errorDataType}
                        >
                            {dataOptions}
                        </InputError>
                    </Col>
                    <Col xs={12} md={6}>
                        <InputError
                            label="Organism"
                            name="organism"
                            type="select"
                            value={this.props.state.organism}
                            onChange={this.props.onChange}
                        >
                            {dataOptions}
                        </InputError>
                    </Col>
                </Row>
                <Row>
                    <Col xs={6}>
                        <Checkbox
                            label="Public"
                            checked={this.props.state.isPublic}
                            onClick={this.props.toggle}
                        />
                    </Col>
                    {extraComponent}
                </Row>
            </div>
        );
    }
}
