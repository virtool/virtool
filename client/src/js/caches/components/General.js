import React from "react";
import PropTypes from "prop-types";
import { Table } from "../../base/Table";

const CacheGeneral = ({ hash, program }) => (
    <Table>
        <tbody>
            <tr>
                <th>Hash</th>
                <td>{hash}</td>
            </tr>
            <tr>
                <th>Trimming Program</th>
                <td>{program}</td>
            </tr>
        </tbody>
    </Table>
);

CacheGeneral.propTypes = {
    hash: PropTypes.string.isRequired,
    program: PropTypes.string.isRequired
};

export default CacheGeneral;
