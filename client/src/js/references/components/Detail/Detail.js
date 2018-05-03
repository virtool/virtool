import React from "react";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Table } from "react-bootstrap";

import RemoveReference from "./RemoveReference";
import { getReference } from "../../actions";
import { LoadingPlaceholder, Icon, Flex, FlexItem, RelativeTime } from "../../../base";

class ReferenceDetail extends React.Component {

    componentDidMount () {
        this.props.getReference(this.props.match.params.refId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const {
            contributors,
            created_at,
            data_type,
            description,
            id,
            internal_control,
            latest_build,
            name,
            organism,
            user
        } = this.props.detail;

        const editIcon = (
            <span>
                <small key="edit-icon" style={{paddingLeft: "5px"}}>
                    <Icon
                        bsStyle="warning"
                        name="pencil"

                        onClick={this.props.showEdit}
                    />
                </small>
            </span>
        );

        return (
            <div>
                <Helmet>
                    <title>{name}</title>
                </Helmet>

                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                {name}
                            </strong>
                        </FlexItem>

                        {editIcon}
                    </Flex>
                </h3>

                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Name</th>
                            <td className="col-xs-8">{name}</td>
                        </tr>
                        <tr>
                            <th>ID</th>
                            <td>{id}</td>
                        </tr>
                        <tr>
                            <th>Description</th>
                            <td>{description}</td>
                        </tr>
                        <tr>
                            <th>Data Type</th>
                            <td>{data_type}</td>
                        </tr>
                        <tr>
                            <th>Organism</th>
                            <td>{organism}</td>
                        </tr>
                        <tr>
                            <th>Created</th>
                            <td><RelativeTime time={created_at} /> by {user.id}</td>
                        </tr>
                        <tr>
                            <th>Latest Build</th>
                            <td>{latest_build}</td>
                        </tr>
                        <tr>
                            <th>Internal Control</th>
                            <td>{internal_control}</td>
                        </tr>
                        <tr>
                            <th>Public</th>
                            <td>{`${this.props.detail.public}`}</td>
                        </tr>
                        <tr>
                            <th>Contributors</th>
                            <td>{contributors.id || "none"}</td>
                        </tr>
                    </tbody>
                </Table>

                <RemoveReference id={id} />
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({

    getReference: (refId) => {
        dispatch(getReference(refId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetail);
