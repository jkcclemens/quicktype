"use strict";

import * as _ from "lodash";

import { Type, EnumType, ClassType, nullableFromUnion, directlyReachableSingleNamedType, matchType } from "../Type";
import { TypeGraph } from "../TypeGraph";

import { Sourcelike, modifySource } from "../Source";
import {
    legalizeCharacters,
    splitIntoWords,
    combineWords,
    firstUpperWordStyle,
    allUpperWordStyle,
    allLowerWordStyle,
    utf32ConcatMap,
    isPrintable,
    escapeNonPrintableMapper,
    intToHex
} from "../Strings";
import { intercalate } from "../Support";

import { Namer, Name } from "../Naming";

import { ConvenienceRenderer } from "../ConvenienceRenderer";

import { TargetLanguage } from "../TargetLanguage";
import { Option } from "../RendererOptions";

const unicode = require("unicode-properties");

function unicodeEscape(codePoint: number): string {
    return "\\u{" + intToHex(codePoint, 0) + "}";
}

const stringEscape = utf32ConcatMap(escapeNonPrintableMapper(isPrintable, unicodeEscape));

export default class RubyTargetLanguage extends TargetLanguage {
    constructor() {
        super("Ruby", ["ruby"], "rb");
    }

    protected getOptions(): Option<any>[] {
        return [];
    }

    get supportsOptionalClassProperties(): boolean {
        return true;
    }

    protected get defaultIndentation(): string {
        return "  ";
    }

    protected get rendererClass(): new (
        graph: TypeGraph,
        leadingComments: string[] | undefined,
        ...optionValues: any[]
    ) => ConvenienceRenderer {
        return RubyRenderer;
    }
}

function isStartCharacter(utf16Unit: number): boolean {
    return unicode.isAlphabetic(utf16Unit) || utf16Unit === 0x5f; // underscore
}

function isPartCharacter(utf16Unit: number): boolean {
    const category: string = unicode.getCategory(utf16Unit);
    return _.includes(["Nd", "Pc", "Mn", "Mc"], category) || isStartCharacter(utf16Unit);
}

const legalizeName = legalizeCharacters(isPartCharacter);

function simpleNameStyle(original: string, uppercase: boolean): string {
    const words = splitIntoWords(original);
    return combineWords(
        words,
        legalizeName,
        uppercase ? firstUpperWordStyle : allLowerWordStyle,
        uppercase ? firstUpperWordStyle : allLowerWordStyle,
        allUpperWordStyle,
        allUpperWordStyle,
        "",
        isStartCharacter
    );
}

function memberNameStyle(original: string): string {
    const words = splitIntoWords(original);
    return combineWords(
        words,
        legalizeName,
        allLowerWordStyle,
        allLowerWordStyle,
        allLowerWordStyle,
        allUpperWordStyle,
        "_",
        isStartCharacter
    );
}

class RubyRenderer extends ConvenienceRenderer {
    constructor(graph: TypeGraph, leadingComments: string[] | undefined) {
        super(graph, leadingComments);
    }

    protected emitDescriptionBlock(lines: string[]): void {
        this.emitCommentLines(lines, "# ");
    }

    protected get needsTypeDeclarationBeforeUse(): boolean {
        return true;
    }

    protected topLevelNameStyle(rawName: string): string {
        return simpleNameStyle(rawName, true);
    }

    protected makeNamedTypeNamer(): Namer {
        return new Namer("types", n => simpleNameStyle(n, true), []);
    }

    protected namerForClassProperty(): Namer {
        return new Namer("properties", memberNameStyle, []);
    }

    protected makeUnionMemberNamer(): null {
        return null;
    }

    protected makeEnumCaseNamer(): Namer {
        return new Namer("enum-cases", n => simpleNameStyle(n, true), []);
    }

    protected namedTypeToNameForTopLevel(type: Type): Type | undefined {
        return directlyReachableSingleNamedType(type);
    }

    dryType = (t: Type): Sourcelike => {
        return matchType<Sourcelike>(
            t,
            _anyType => "Types::Any",
            _nullType => "Types::Nil",
            _boolType => "Types::Bool",
            _integerType => "Types::Int",
            _doubleType => "Types::Decimal",
            _stringType => "Types::String",
            arrayType => ["Types.Array(", this.dryType(arrayType.items), ")"],
            classType => ["Types.Instance(", this.nameForNamedType(classType), ")"],
            _mapType => "Types::Hash", // ["Map<String, ", this.dryType(mapType.values), ">"],
            enumType => ["Types::", this.nameForNamedType(enumType)],
            unionType => {
                const nullable = nullableFromUnion(unionType);
                if (nullable !== null) return [this.dryType(nullable), ".optional"];
                const children = unionType.children.map((c: Type) => this.dryType(c));
                return intercalate(" | ", children).toArray();
            }
        );
    };

    fromDynamic = (t: Type, e: Sourcelike): Sourcelike => {
        return matchType<Sourcelike>(
            t,
            _anyType => e,
            _nullType => e,
            _boolType => e,
            _integerType => e,
            _doubleType => e,
            _stringType => e,
            arrayType => [e, ".map { |x| ", this.fromDynamic(arrayType.items, "x"), " }"],
            classType => [this.nameForNamedType(classType), ".from_dynamic(", e, ")"],
            _mapType => e, // "Types::Hash", // ["Map<String, ", this.dryType(mapType.values), ">"],
            enumType => ["Types::", this.nameForNamedType(enumType), "[", e, "]"],
            unionType => {
                const nullable = nullableFromUnion(unionType);
                if (nullable !== null) {
                    return [e, ".nil? ? nil : ", this.fromDynamic(nullable, e)];
                }
                return "FIXME";
            }
        );
    };

    toDynamic = (t: Type, e: Sourcelike): Sourcelike => {
        return matchType<Sourcelike>(
            t,
            _anyType => e,
            _nullType => e,
            _boolType => e,
            _integerType => e,
            _doubleType => e,
            _stringType => e,
            arrayType => [e, ".map { |x| ", this.toDynamic(arrayType.items, "x"), " }"],
            _classType => [e, ".dynamic"],
            _mapType => e, // "Types::Hash", // ["Map<String, ", this.dryType(mapType.values), ">"],
            _enumType => e,
            unionType => {
                const nullable = nullableFromUnion(unionType);
                if (nullable !== null) {
                    return [e, ".nil? ? nil : ", this.fromDynamic(nullable, e)];
                }
                return "FIXME";
            }
        );
    };

    private emitBlock(source: Sourcelike[], emit: () => void) {
        this.emitLine(source);
        this.indent(emit);
        this.emitLine("end");
    }

    private emitClass = (c: ClassType, className: Name) => {
        this.emitDescription(this.descriptionForType(c));
        this.emitBlock(["class ", className, " < Dry::Struct"], () => {
            const table: Sourcelike[][] = [];
            this.forEachClassProperty(c, "none", (name, jsonName, p) => {
                this.emitDescription(this.descriptionForClassProperty(c, jsonName));
                table.push([["attribute :", name, ","], [" ", this.dryType(p.type), p.isOptional ? ".optional" : ""]]);
            });
            this.emitTable(table);
            this.ensureBlankLine();
            this.emitBlock(["def self.from_dynamic(d)"], () => {
                this.emitLine(className, ".new(");
                this.indent(() => {
                    const inits: Sourcelike[][] = [];
                    this.forEachClassProperty(c, "none", (name, jsonName, p) => {
                        const dynamic = `d["${stringEscape(jsonName)}"]`;
                        const expression: Sourcelike = p.isOptional
                            ? [dynamic, ".nil? ? nil : ", this.fromDynamic(p.type, dynamic)]
                            : this.fromDynamic(p.type, dynamic);
                        inits.push([[name, ": "], [expression, ","]]);
                    });
                    this.emitTable(inits);
                });
                this.emitLine(")");
            });
            this.ensureBlankLine();
            this.emitLine("def self.from_json(json) self.from_dynamic(JSON.parse(json)) end");
            this.ensureBlankLine();
            this.emitBlock(["def dynamic"], () => {
                this.emitLine("{");
                this.indent(() => {
                    const inits: Sourcelike[][] = [];
                    this.forEachClassProperty(c, "none", (name, jsonName, p) => {
                        const dynamic = ["self.", name];
                        const expression: Sourcelike = p.isOptional
                            ? [dynamic, ".nil? ? nil : ", this.toDynamic(p.type, dynamic)]
                            : this.toDynamic(p.type, dynamic);
                        inits.push([[`"${stringEscape(jsonName)}"`], [" => ", expression, ","]]);
                    });
                    this.emitTable(inits);
                });
                this.emitLine("}");
            });
            this.ensureBlankLine();
            this.emitLine("def to_json() JSON.generate(self.dynamic) end");
        });
    };

    emitEnum = (e: EnumType, enumName: Name) => {
        this.emitDescription(this.descriptionForType(e));
        this.emitBlock(["module ", enumName], () => {
            this.forEachEnumCase(e, "none", (name, json) => {
                this.emitLine(name, ` = "${stringEscape(json)}"`);
            });
        });
    };

    private emitEnumDeclaration(e: EnumType, name: Name) {
        const cases: Sourcelike[][] = [];
        this.forEachEnumCase(e, "none", (_name, json) => {
            cases.push([cases.length === 0 ? "" : ", ", `"${stringEscape(json)}"`]);
        });
        this.emitLine(name, " = Types::String.enum(", ...cases, ")");
    }

    protected emitSourceStructure() {
        if (this.leadingComments !== undefined) {
            this.emitCommentLines(this.leadingComments);
        } else {
            this.emitLine("# To parse JSON, add 'dry-struct' and 'dry-types' gems, then:");
            this.emitLine("#");
            this.forEachTopLevel("none", (_t, name) => {
                this.emitLine("#   let ", modifySource(_.snakeCase, name), " = ", name, '.from_json "..."');
            });
            this.emitLine("#");
        }
        this.ensureBlankLine();

        this.emitLine("require 'json'");
        this.emitLine("require 'dry-types'");
        this.emitLine("require 'dry-struct'");
        this.ensureBlankLine();

        this.emitBlock(["module Types"], () => {
            this.emitLine("include Dry::Types.module");
            this.forEachNamedType(
                "none",
                (_c, _n) => undefined,
                (e, n) => this.emitEnumDeclaration(e, n),
                (_u, _n) => undefined
            );
        });

        this.forEachNamedType(
            "leading-and-interposing",
            (c, n) => this.emitClass(c, n),
            (e, n) => this.emitEnum(e, n),
            (_u, _n) => undefined
        );
    }
}
