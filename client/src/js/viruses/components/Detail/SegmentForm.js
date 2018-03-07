import React from "react";
import PropTypes from "prop-types";
import { Row, Col, Alert } from "react-bootstrap";
import { map } from "lodash-es";
import { InputError, Checkbox } from "../../../base";

export default class SegmentForm extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            isChecked: true,
            showError: this.props.show
        };
    }

    componentWillReceiveProps (nextProps) {
        this.setState({
            isChecked: nextProps.newEntry.required,
            showError: nextProps.show
        });
    }

    changeSegName = (e) => {
        this.props.onChange({
            ...this.props.newEntry,
            name: e.target.value
        });
    };

    changeMolType = (e) => {
        this.props.onChange({
            ...this.props.newEntry,
            molecule: e.target.value
        });
    };

    toggleCheck = () => {
        this.props.onChange({
            ...this.props.newEntry,
            required: !this.state.isChecked
        });
        this.setState({isChecked: !this.state.isChecked});
    };

    render () {

        const errorMessage = this.state.showError ? "Required Field" : "";

        const alert = this.props.segmentExists ? (
            <Row>
                <Col md={12}>
                    <Alert bsStyle="danger" style={{margin: "10px 0 0 0"}}>
                        <span>Segment names must be unique. This name is currently in use.</span>
                    </Alert>
                </Col>
            </Row>
        ) : null;

        const moleculeTypes = [
            "",
            "ssDNA",
            "dsDNA",
            "ssRNA+",
            "ssRNA-",
            "ssRNA",
            "dsRNA"
        ];

        const molecules = map(moleculeTypes, (molecule) =>
            <option key={molecule} value={molecule}>
                {molecule || "None"}
            </option>
        );

        return (
            <form>
                <Row>
                    <Col md={9}>
                        <InputError
                            label="Name"
                            value={this.props.newEntry.name}
                            onChange={this.changeSegName}
                            error={errorMessage}
                        />
                    </Col>
                    <Col md={3}>
                        <InputError
                            type="select"
                            label="Molecule Type"
                            value={this.props.newEntry.molecule}
                            onChange={this.changeMolType}
                        >
                            {molecules}
                        </InputError>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Checkbox
                            label="Segment Required"
                            checked={this.state.isChecked}
                            onClick={this.toggleCheck}
                            pullLeft
                        />
                    </Col>
                </Row>
                {alert}
            </form>
        );
    }
}

SegmentForm.propTypes = {
    onChange: PropTypes.func.isRequired,
    newEntry: PropTypes.object.isRequired,
    show: PropTypes.bool,
    segmentExists: PropTypes.bool
};
