"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const get_definitely_typed_1 = require("./get-definitely-typed");
const common_1 = require("./lib/common");
const packages_1 = require("./lib/packages");
const settings_1 = require("./lib/settings");
const io_1 = require("./util/io");
const util_1 = require("./util/util");
if (!module.parent) {
    util_1.done(main(common_1.Options.defaults));
}
function main(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const allPackages = yield packages_1.AllPackages.read(yield get_definitely_typed_1.getDefinitelyTyped(options));
        const typings = allPackages.allTypings();
        const maxPathLen = Math.max(...typings.map(t => t.subDirectoryPath.length));
        const lines = util_1.mapDefined(typings, t => getEntry(t, maxPathLen));
        const text = `${header}\n\n${lines.join("\n")}\n`;
        const path = util_1.joinPaths(options.definitelyTypedPath, ".github", "CODEOWNERS");
        yield io_1.writeFile(path, text);
    });
}
const header = `# This file is generated.
# Add yourself to the "Definitions by:" list instead.
# See https://github.com/DefinitelyTyped/DefinitelyTyped#edit-an-existing-package`;
function getEntry(pkg, maxPathLen) {
    const users = util_1.mapDefined(pkg.contributors, c => c.githubUsername);
    if (!users.length) {
        return undefined;
    }
    const path = `${pkg.subDirectoryPath}/`.padEnd(maxPathLen);
    return `/${settings_1.typesDirectoryName}/${path} ${users.map(u => `@${u}`).join(" ")}`;
}
//# sourceMappingURL=code-owners.js.map