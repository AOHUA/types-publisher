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
const assert = require("assert");
const definitelytyped_header_parser_1 = require("definitelytyped-header-parser");
const util_1 = require("../util/util");
const common_1 = require("./common");
const versionsFilename = "versions.json";
const changesFilename = "version-changes.json";
class Versions {
    constructor(data) {
        this.data = data;
    }
    static load() {
        return __awaiter(this, void 0, void 0, function* () {
            const raw = yield common_1.readDataFile("calculate-versions", versionsFilename);
            for (const packageName in raw) {
                const majorVersions = raw[packageName];
                for (const majorVersion in majorVersions) {
                    const info = majorVersions[majorVersion];
                    if (info.latestNonPrerelease) {
                        info.latestNonPrerelease = Semver.fromRaw(info.latestNonPrerelease);
                    }
                }
            }
            return new Versions(raw);
        });
    }
    /**
     * Calculates versions and changed packages by comparing contentHash of parsed packages the NPM registry.
     */
    static determineFromNpm(allPackages, log, forceUpdate, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = [];
            const data = {};
            for (const pkg of allPackages.allTypings()) {
                const isPrerelease = definitelytyped_header_parser_1.TypeScriptVersion.isPrerelease(pkg.typeScriptVersion);
                const versionInfo = yield fetchTypesPackageVersionInfo(pkg, client, isPrerelease, pkg.majorMinor);
                if (!versionInfo) {
                    log(`Added: ${pkg.desc}`);
                }
                // tslint:disable-next-line:prefer-const
                let { version, latestNonPrerelease, contentHash, deprecated } = versionInfo || defaultVersionInfo(isPrerelease);
                if (deprecated) {
                    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
                    assert(pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras", `Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
                }
                if (forceUpdate || !versionInfo || pkg.major !== version.major || pkg.minor !== version.minor || pkg.contentHash !== contentHash) {
                    log(`Changed: ${pkg.desc}`);
                    changes.push(pkg.id);
                    version = version.update(pkg.majorMinor, isPrerelease);
                }
                addToData(pkg.name, version, latestNonPrerelease);
            }
            for (const pkg of allPackages.allNotNeeded()) {
                const isPrerelease = false; // Not-needed packages are never prerelease.
                // tslint:disable-next-line:prefer-const
                let { version, deprecated } = (yield fetchTypesPackageVersionInfo(pkg, client, isPrerelease)) || defaultVersionInfo(isPrerelease);
                if (!deprecated) {
                    log(`Now deprecated: ${pkg.name}`);
                    changes.push({ name: pkg.name, majorVersion: version.major });
                    version = pkg.version;
                }
                addToData(pkg.name, version);
            }
            // Sort keys so that versions.json is easy to read
            return { versions: new Versions(util_1.sortObjectKeys(data)), changes };
            function defaultVersionInfo(isPrerelease) {
                return { version: new Semver(-1, -1, -1, isPrerelease), latestNonPrerelease: undefined, contentHash: "", deprecated: false };
            }
            function addToData(packageName, { major, patch }, latestNonPrerelease) {
                let majorVersions = data[packageName];
                if (!majorVersions) {
                    majorVersions = data[packageName] = {};
                }
                assert(!majorVersions[major]);
                majorVersions[major] = latestNonPrerelease ? { patch, latestNonPrerelease } : { patch };
            }
        });
    }
    save() {
        return common_1.writeDataFile(versionsFilename, this.data);
    }
    getVersion(pkg) {
        return new Semver(pkg.major, pkg.minor, this.info(pkg.id).patch, pkg.isPrerelease);
    }
    latestNonPrerelease(pkg) {
        const info = this.info(pkg.id);
        return pkg.isLatest ? this.getVersion(pkg) : util_1.assertDefined(info.latestNonPrerelease);
    }
    info({ name, majorVersion }) {
        const info = this.data[name][majorVersion];
        if (!info) {
            throw new Error(`No version info for ${name}@${majorVersion}`);
        }
        return info;
    }
}
exports.default = Versions;
function changedPackages(allPackages, changes) {
    return __awaiter(this, void 0, void 0, function* () {
        return changes.map(changedPackageName => allPackages.getAnyPackage(changedPackageName));
    });
}
exports.changedPackages = changedPackages;
/** Version of a package published to NPM. */
class Semver {
    constructor(major, minor, patch, 
    /**
     * If true, this is `major.minor.0-next.patch`.
     * If false, this is `major.minor.patch`.
     */
    isPrerelease) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.isPrerelease = isPrerelease;
    }
    static parse(semver, isPrerelease) {
        const result = Semver.tryParse(semver, isPrerelease);
        if (!result) {
            throw new Error(`Unexpected semver: ${semver} (isPrerelease: ${isPrerelease})`);
        }
        return result;
    }
    static fromRaw({ major, minor, patch, isPrerelease }) {
        return new Semver(major, minor, patch, isPrerelease);
    }
    // This must parse the output of `versionString`.
    static tryParse(semver, isPrerelease) {
        // Per the semver spec <http://semver.org/#spec-item-2>:
        // "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."
        const rgx = isPrerelease ? /^(\d+)\.(\d+)\.0-next.(\d+)$/ : /^(\d+)\.(\d+)\.(\d+)$/;
        const match = rgx.exec(semver);
        return match ? new Semver(util_1.intOfString(match[1]), util_1.intOfString(match[2]), util_1.intOfString(match[3]), isPrerelease) : undefined;
    }
    get versionString() {
        const { isPrerelease, major, minor, patch } = this;
        return isPrerelease ? `${major}.${minor}.0-next.${patch}` : `${major}.${minor}.${patch}`;
    }
    equals(sem) {
        return this.major === sem.major && this.minor === sem.minor && this.patch === sem.patch && this.isPrerelease === sem.isPrerelease;
    }
    greaterThan(sem) {
        return this.major > sem.major || this.major === sem.major
            && (this.minor > sem.minor || this.minor === sem.minor && this.patch > sem.patch);
    }
    update({ major, minor }, isPrerelease) {
        const patch = this.major === major && this.minor === minor && this.isPrerelease === isPrerelease ? this.patch + 1 : 0;
        return new Semver(major, minor, patch, isPrerelease);
    }
}
exports.Semver = Semver;
/** Returns undefined if the package does not exist. */
function fetchTypesPackageVersionInfo(pkg, client, isPrerelease, newMajorAndMinor) {
    return __awaiter(this, void 0, void 0, function* () {
        return fetchVersionInfoFromNpm(pkg.fullEscapedNpmName, pkg.isNotNeeded() ? undefined : pkg.contentHash, client, isPrerelease, newMajorAndMinor);
    });
}
/** For use by publish-registry only. */
function fetchAndProcessNpmInfo(escapedPackageName, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const info = util_1.assertDefined(yield client.fetchNpmInfo(escapedPackageName));
        const version = getVersionSemver(info, /*isPrerelease*/ false);
        const { distTags, versions, timeModified } = info;
        const highestSemverVersion = getLatestVersion(versions.keys());
        assert.equal(highestSemverVersion.versionString, distTags.get("next"));
        const contentHash = versions.get(version.versionString).typesPublisherContentHash || "";
        return { version, highestSemverVersion, contentHash, lastModified: new Date(timeModified) };
    });
}
exports.fetchAndProcessNpmInfo = fetchAndProcessNpmInfo;
function fetchVersionInfoFromNpm(escapedPackageName, parsedContentHash, client, isPrerelease, newMajorAndMinor) {
    return __awaiter(this, void 0, void 0, function* () {
        const info = yield client.getNpmInfo(escapedPackageName, parsedContentHash);
        if (info === undefined) {
            return undefined;
        }
        const { versions } = info;
        const latestNonPrerelease = !isPrerelease ? undefined : getLatestVersion(versions.keys());
        const version = getVersionSemver(info, isPrerelease, newMajorAndMinor);
        const latestVersionInfo = util_1.assertDefined(versions.get(version.versionString));
        const contentHash = latestVersionInfo.typesPublisherContentHash || "";
        const deprecated = !!latestVersionInfo.deprecated;
        return { version, latestNonPrerelease, contentHash, deprecated };
    });
}
function getLatestVersion(versions) {
    return util_1.best(util_1.map(versions, parseAnySemver), (a, b) => {
        if (a.isPrerelease && !b.isPrerelease) {
            return false;
        }
        if (!a.isPrerelease && b.isPrerelease) {
            return true;
        }
        return a.greaterThan(b);
    });
}
function getVersionSemver(info, isPrerelease, newMajorAndMinor) {
    // If there's already a published package with this version, look for that first.
    if (newMajorAndMinor) {
        const { major, minor } = newMajorAndMinor;
        const patch = latestPatchMatchingMajorAndMinor(info.versions.keys(), major, minor, isPrerelease);
        if (patch !== undefined) {
            return new Semver(major, minor, patch, isPrerelease);
        }
    }
    // Usually latest version should never be a prerelease, but it may if we've only ever published prerelease versions.
    return parseAnySemver(util_1.assertDefined(info.distTags.get("latest")));
}
/** Parse a semver that may not follow X.Y.Z format perfectly. */
function parseAnySemver(s) {
    // Once upon a time we published -alpha versions.
    const alpha = /^(.*)-alpha/.exec(s);
    if (alpha) {
        return Semver.parse(alpha[1], /*isPrerelase*/ false);
    }
    else if (/^(.*)-next.\d+/.test(s)) {
        return Semver.parse(s, /*isPrerelease*/ true);
    }
    else {
        return Semver.parse(s, /*isPrerelease*/ false);
    }
}
/** Finds the version with matching major/minor with the latest patch version. */
function latestPatchMatchingMajorAndMinor(versions, newMajor, newMinor, isPrerelease) {
    const versionsWithTypings = util_1.mapDefined(versions, v => {
        const semver = Semver.tryParse(v, isPrerelease);
        if (!semver) {
            return undefined;
        }
        const { major, minor, patch } = semver;
        return major === newMajor && minor === newMinor ? patch : undefined;
    });
    return util_1.best(versionsWithTypings, (a, b) => a > b);
}
function readVersionsAndChanges() {
    return __awaiter(this, void 0, void 0, function* () {
        return { versions: yield Versions.load(), changes: yield readChanges() };
    });
}
exports.readVersionsAndChanges = readVersionsAndChanges;
/** Read all changed packages. */
function readChanges() {
    return common_1.readDataFile("calculate-versions", changesFilename);
}
exports.readChanges = readChanges;
function writeChanges(changes) {
    return __awaiter(this, void 0, void 0, function* () {
        yield common_1.writeDataFile(changesFilename, changes);
    });
}
exports.writeChanges = writeChanges;
//# sourceMappingURL=versions.js.map