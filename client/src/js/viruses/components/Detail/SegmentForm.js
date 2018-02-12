import React from "react";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";
import { Input, Checkbox } from "../../../base";

export default class SegmentForm extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            isChecked: false,
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
    }

    changeMolType = (e) => {
        this.props.onChange({
            ...this.props.newEntry,
            molecule: e.target.value
        });
    }

    toggleCheck = () => {
        this.props.onChange({
            ...this.props.newEntry,
            required: !this.state.isChecked
        });
        this.setState({isChecked: !this.state.isChecked});
    }

    render () {

        const errorMessage = this.state.showError ? "Required Field" : "";

        return (
            <form>
                <Row>
                    <Col md={9}>
                        <Input
                            label="Name"
                            value={this.props.newEntry.name}
                            onChange={(e) => {this.changeSegName(e)}}
                            error={errorMessage}
                        />
                    </Col>

                    <Col md={3}>
                        <Input
                            type="select"
                            label="Molecule Type"
                            value={this.props.newEntry.molecule}
                            onChange={(e) => {this.changeMolType(e)}}
                        >
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
            </form>
        );
    }
}

SegmentForm.propTypes = {
    onChange: PropTypes.func.isRequired,
    newEntry: PropTypes.shape({
        name: PropTypes.string,
        molecule: PropTypes.string,
        required: PropTypes.bool
    }).isRequired,
    show: PropTypes.bool
};
