"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var NocSyosetu_1 = __importDefault(require("@plugins/japanese/NocSyosetu"));
var Pixiv_1 = __importDefault(require("@plugins/japanese/Pixiv"));
var jukanovel_1 = __importDefault(require("@plugins/multi/jukanovel"));
var akaytruyen_1 = __importDefault(require("@plugins/vietnamese/akaytruyen"));
var BaoMoi_1 = __importDefault(require("@plugins/vietnamese/BaoMoi"));
var doctruyenln_1 = __importDefault(require("@plugins/vietnamese/doctruyenln"));
var LNHako_1 = __importDefault(require("@plugins/vietnamese/LNHako"));
var LNKuro_1 = __importDefault(require("@plugins/vietnamese/LNKuro"));
var luvevaland_1 = __importDefault(require("@plugins/vietnamese/luvevaland"));
var SangTacViet_1 = __importDefault(require("@plugins/vietnamese/SangTacViet"));
var tieuthuyetmang_1 = __importDefault(require("@plugins/vietnamese/tieuthuyetmang"));
var truyenfull_1 = __importDefault(require("@plugins/vietnamese/truyenfull"));
var valvrareteam_1 = __importDefault(require("@plugins/vietnamese/valvrareteam"));
var wanwansekai_1 = __importDefault(require("@plugins/vietnamese/wanwansekai"));
var ZumiNovel_1 = __importDefault(require("@plugins/vietnamese/ZumiNovel"));
var TomatoMTL_1 = __importDefault(require("@plugins/vietnamese/TomatoMTL"));
var PLUGINS = [
    NocSyosetu_1.default,
    Pixiv_1.default,
    jukanovel_1.default,
    akaytruyen_1.default,
    BaoMoi_1.default,
    doctruyenln_1.default,
    LNHako_1.default,
    LNKuro_1.default,
    luvevaland_1.default,
    SangTacViet_1.default,
    tieuthuyetmang_1.default,
    truyenfull_1.default,
    valvrareteam_1.default,
    wanwansekai_1.default,
    ZumiNovel_1.default,
    TomatoMTL_1.default,
];
exports.default = PLUGINS;
