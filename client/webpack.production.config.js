var path = require("path");
var webpack = require("webpack");
var HTMLPlugin = require("html-webpack-plugin");
var CleanPlugin = require("clean-webpack-plugin");
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {

    entry: ["babel-polyfill", "./src/js/index.js"],

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules)/,
                use: [
                    "babel-loader",
                    {
                        loader: "eslint-loader",
                        options: {
                            configFile: path.resolve(__dirname, "./.eslintrc")
                        }

                    }
                ]
            },

            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: "css-loader"
                })
            },

            {
                test: /\.less$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        {loader: "css-loader"},
                        {loader: "less-loader"}
                    ]
                })
            },

            {
                test: /\.woff$/,
                use: {
                    loader: "url-loader?limit=100000"
                }
            }
        ]
    },

    resolve: {
        alias: {virtool: path.resolve(__dirname, "./src")}
    },

    node: {
        fs: "empty"
    },

    output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "app.[hash:8].js",
        publicPath: "/static/"
    },

    plugins: [
        new webpack.DefinePlugin({
            "process.env": {
                "NODE_ENV": JSON.stringify("production")
            }
        }),

        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: true
            },

            comments: false
        }),

        new ExtractTextPlugin("style.[hash:8].css"),

        new HTMLPlugin({
            filename: "index.html",
            title: "Virtool",
            favicon: "./src/images/favicon.ico",
            template: "./src/index.html",
            inject: "body"
        }),

        new CleanPlugin(["dist"], {
            verbose: true
        })
    ]
};
