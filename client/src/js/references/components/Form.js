import React from "react";
import { Row, Col } from "react-bootstrap";
import { InputError } from "../../base";

export default class ReferenceForm extends React.Component {
    render() {
        let extraComponent;

        if (this.props.state.errorFile != null || this.props.state.errorSelect != null) {
            extraComponent = (
                <Col xs={12}>
                    <div className="input-form-error">
                        <span className="input-error-message" style={{ margin: "0 0 0 0" }}>
                            {this.props.state.errorFile || this.props.state.errorSelect}
                        </span>
                    </div>
                </Col>
            );
        }

        return (
            <div>
                <Row>{extraComponent}</Row>
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
                            label="Organism"
                            name="organism"
                            value={this.props.state.organism}
                            onChange={this.props.onChange}
                        />
                    </Col>
                </Row>
            </div>
        );
    }
}
