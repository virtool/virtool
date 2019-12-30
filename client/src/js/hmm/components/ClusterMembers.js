import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { ExternalLink } from "../../base";

export class ClusterMembers extends React.Component {
    render() {
        return map(this.props.detail.entries, ({ name, accession, organism }, index) => (
            <tr key={index}>
                <td>
                    <ExternalLink
                        href={`http://www.ncbi.nlm.nih.gov/protein/${accession}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {accession}
                    </ExternalLink>
                </td>
                <td>{name}</td>
                <td>{organism}</td>
            </tr>
        ));
    }
}

export const mapStateToProps = state => ({
    detail: state.hmms.detail
});

export default connect(mapStateToProps)(ClusterMembers);
