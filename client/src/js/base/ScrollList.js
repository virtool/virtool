import React from "react";
import { map } from "lodash-es";
import { LoadingPlaceholder } from "./index";

export class ScrollList extends React.Component {

    componentDidMount () {
        window.addEventListener("scroll", this.onScroll, false);
    }

    componentWillUnMount () {
        window.removeEventListener("scroll", this.onScroll, false);
    }

    onScroll = () => {
        // Scroll bar reaches the bottom of page when ratio = 1
        // Want to load available page when scroll bar nears the bottom
        const totalHeight = document.body.scrollHeight;
        const windowHeight = window.innerHeight;
        const distScrolled = window.scrollY;
        const ratio = ((windowHeight + distScrolled) / totalHeight).toFixed(1);

        if (this.props.list.length
            && this.props.hasNextPage
            && !this.props.isNextPageLoading
            && (ratio > 0.8)
        ) {
            this.props.loadNextPage(this.props.page + 1);
        }
    };

    render () {
        const { list, rowRenderer, isNextPageLoading } = this.props;

        return (
            <div>
                {map(list, (item, index) => rowRenderer(index))}
                {isNextPageLoading ? <LoadingPlaceholder margin="20px" /> : null}
            </div>
        );
    }
}
