import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { getBorder, getColor } from "../../../app/theme";
import { Icon } from "../../../base";
import { toThousand } from "../../../utils/utils";

const StyledBarsLegendItem = styled.div`
    align-items: center;
    display: flex;
    margin-top: 3px;
    max-width: 480px;

    i:first-child {
        margin-right: 10px;
    }

    span:last-child {
        margin-left: auto;
    }
`;

const Bar = styled.div`
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.md};
    display: flex;
    height: 32px;
    margin-bottom: 15px;
    overflow: hidden;
    z-index: 10;
`;

const BarItem = styled.div`
    background-color: ${getColor};
    flex: ${props => props.size / 100} 0 auto;
    z-index: 1;
`;

const EmptyBarItem = styled(BarItem)`
    background-color: ${props => props.theme.color.white};
    box-shadow: ${props => props.theme.boxShadow.inset};
`;

const BarsLegendItem = ({ color, count, title }) => (
    <StyledBarsLegendItem>
        <Icon name="circle" color={color} shade="" />
        <span>{title}</span>
        <span>{count}</span>
    </StyledBarsLegendItem>
);

const StyledBars = styled.div`
    margin-bottom: 10px;
`;

export const Bars = ({ empty, items }) => {
    const barItems = map(items, ({ color, count }) => <BarItem key={color} color={color} size={count} />);

    const legendItems = map(items, ({ color, count, title }) => (
        <BarsLegendItem key={color} color={color} count={toThousand(count)} title={title} />
    ));

    let emptyBar;

    if (empty) {
        emptyBar = <EmptyBarItem key="empty" color="white" size={empty} />;
    }

    return (
        <StyledBars>
            <Bar>
                {barItems}
                {emptyBar}
            </Bar>
            <div>{legendItems}</div>
        </StyledBars>
    );
};
