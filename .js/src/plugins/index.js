"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var akaytruyen_1 = __importDefault(require("@plugins/vietnamese/akaytruyen"));
var LNHako_1 = __importDefault(require("@plugins/vietnamese/LNHako"));
var PLUGINS = [akaytruyen_1.default, LNHako_1.default];
exports.default = PLUGINS;
