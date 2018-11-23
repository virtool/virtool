/* global __dirname */
import path from "path";
import HTMLPlugin from "html-webpack-plugin";
import CleanPlugin from "clean-webpack-plugin";
import ExtractTextPlugin from "extract-text-webpack-plugin";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

export default {
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
              fix: true,
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
          use: [{ loader: "css-loader" }, { loader: "less-loader" }]
        })
      },

      {
        test: /\.(woff|woff2)$/,
        use: {
          loader: "url-loader?limit=100000"
        }
      }
    ]
  },

  node: {
    fs: "empty"
  },

  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "app.[hash:8].js",
    publicPath: "/static/"
  },

  mode: "development",

  plugins: [
    new ExtractTextPlugin("style.[hash:8].css"),

    new HTMLPlugin({
      filename: "index.html",
      title: "Virtool",
      favicon: "./src/images/favicon.ico",
      template: "./src/index.html",
      inject: "body"
    }),

    new CleanPlugin(["dist"], {
      verbose: true,
      watch: true
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: "server",
      analyzerHost: "localhost",
      analyzerPort: 8890,
      openAnalyzer: false
    })
  ],

  watch: true
};
