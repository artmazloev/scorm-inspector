/**
 * Парсер imsmanifest.xml (T-011, RQ-010).
 *
 * Достаёт из манифеста:
 * - версию SCORM (2004 3rd/4th ed. по identifier схемы adlcp_v1p3 + schemaversion);
 * - организацию(-ии) по умолчанию: identifier, title, структура items;
 * - ресурсы: identifier, type, href, files.
 *
 * Результаты проверок возвращаются как находки (severity: error|warning|info),
 * парсер никогда не бросает исключение по содержимому манифеста —
 * ошибка парсинга есть находка, а не падение (критерий T-011).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export type Severity = "error" | "warning" | "info";

export interface Finding {
  category: string;
  severity: Severity;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ManifestItem {
  identifier?: string;
  title?: string;
  identifierref?: string;
  isvisible?: string;
  children?: ManifestItem[];
}

export interface ManifestOrganization {
  identifier?: string;
  title?: string;
  items: ManifestItem[];
}

export interface ManifestResource {
  identifier?: string;
  type?: string;
  adlcpScormType?: string;
  href?: string;
  files: string[];
}

export interface ManifestParseResult {
  ok: boolean;
  /** SCORM-версия: "2004-3rd" | "2004-4th" | null (не определена). */
  scormVersion: string | null;
  schemaversion: string | null;
  organizations: ManifestOrganization[];
  resources: ManifestResource[];
  /** identifier организации по умолчанию (default = organizations/@default). */
  defaultOrganization: string | null;
  findings: Finding[];
}

/** SCORM 2004: schemaversion из adlcp:schemaversion, обычно "_2004_3rd_Edition" / "_2004_4th Edition". */
function detectScormVersion(schemaversion: string | null): {
  version: string | null;
  finding: Finding | null;
} {
  if (!schemaversion) {
    return {
      version: null,
      finding: {
        category: "manifest",
        severity: "error",
        code: "MANIFEST-SCHEMVERSION-MISSING",
        message:
          "Не найден adlcp:schemaversion — версия SCORM не определена (ожидается SCORM 2004)",
      },
    };
  }
  const v = schemaversion.toLowerCase().replace(/[\s_-]+/g, "");
  if (v.includes("3rd")) {
    return { version: "2004-3rd", finding: null };
  }
  if (v.includes("4th")) {
    return { version: "2004-4th", finding: null };
  }
  return {
    version: null,
    finding: {
      category: "manifest",
      severity: "error",
      code: "MANIFEST-VERSION-UNSUPPORTED",
      message: `Неподдерживаемая schemaversion: "${schemaversion}" (поддерживаются SCORM 2004 3rd/4th Edition)`,
      details: { schemaversion },
    },
  };
}

/** Рекурсивный обход item из fast-xml-parser (item может быть объектом или массивом). */
function parseItems(raw: unknown): ManifestItem[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((it) => {
    const obj = (it ?? {}) as Record<string, unknown>;
    return {
      identifier:
        typeof obj["@_identifier"] === "string"
          ? obj["@_identifier"]
          : undefined,
      title:
        typeof (obj.title as Record<string, unknown>)?.["#text"] === "string"
          ? ((obj.title as Record<string, unknown>)["#text"] as string)
          : typeof obj.title === "string"
            ? obj.title
            : undefined,
      identifierref:
        typeof obj["@_identifierref"] === "string"
          ? obj["@_identifierref"]
          : undefined,
      isvisible:
        typeof obj["@_isvisible"] === "string" ? obj["@_isvisible"] : undefined,
      children: parseItems(obj.item),
    };
  });
}

function parseResources(raw: unknown, findings: Finding[]): ManifestResource[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: ManifestResource[] = [];
  for (const r of list) {
    const obj = (r ?? {}) as Record<string, unknown>;
    const files: string[] = [];
    const rawFiles = obj.file;
    if (rawFiles != null) {
      const fl = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
      for (const f of fl) {
        const href = (f as Record<string, unknown>)["@_href"];
        if (typeof href === "string") files.push(href);
      }
    }
    const identifier =
      typeof obj["@_identifier"] === "string" ? obj["@_identifier"] : undefined;
    const scormType = obj["@_adlcp:scormType"];
    if (
      identifier &&
      (scormType === undefined || typeof scormType !== "string")
    ) {
      findings.push({
        category: "manifest",
        severity: "warning",
        code: "MANIFEST-RESOURCE-NO-SCORMTYPE",
        message: `Ресурс "${identifier}" без атрибута adlcp:scormType (sco/asset)`,
        details: { resource: identifier },
      });
    }
    out.push({
      identifier,
      type: typeof obj["@_type"] === "string" ? obj["@_type"] : undefined,
      adlcpScormType: typeof scormType === "string" ? scormType : undefined,
      href: typeof obj["@_href"] === "string" ? obj["@_href"] : undefined,
      files,
    });
  }
  return out;
}

export function parseManifestXml(xml: string): ManifestParseResult {
  const result: ManifestParseResult = {
    ok: false,
    scormVersion: null,
    schemaversion: null,
    organizations: [],
    resources: [],
    defaultOrganization: null,
    findings: [],
  };

  // Сначала строгая проверка well-formedness: fast-xml-parser сам по себе
  // толерантен к незакрытым тегам, а нам нужна находка, а не тихий парсинг.
  const validation = XMLValidator.validate(xml, {
    allowBooleanAttributes: true,
  });
  if (validation !== true) {
    result.findings.push({
      category: "manifest",
      severity: "error",
      code: "MANIFEST-XML-MALFORMED",
      message: `imsmanifest.xml не является корректным XML: ${validation.err.msg} (позиция ${validation.err.line}:${validation.err.col})`,
      details: { line: validation.err.line, col: validation.err.col },
    });
    return result;
  }

  let parsed: Record<string, unknown>;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: false,
      parseTagValue: false,
      trimValues: true,
    });
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch (e) {
    result.findings.push({
      category: "manifest",
      severity: "error",
      code: "MANIFEST-XML-MALFORMED",
      message: `imsmanifest.xml не является корректным XML: ${(e as Error).message}`,
    });
    return result;
  }

  const manifest = (parsed.manifest ?? {}) as Record<string, unknown>;
  if (parsed.manifest === undefined) {
    result.findings.push({
      category: "manifest",
      severity: "error",
      code: "MANIFEST-NO-ROOT",
      message: "Корневой элемент <manifest> не найден",
    });
    return result;
  }
  result.ok = true;

  // Версия SCORM.
  const meta = (manifest.metadata ?? {}) as Record<string, unknown>;
  const sv = meta["adlcp:schemaversion"] ?? meta.schemaversion;
  const schemaversion =
    typeof sv === "string"
      ? sv
      : typeof (sv as Record<string, unknown>)?.["#text"] === "string"
        ? ((sv as Record<string, unknown>)["#text"] as string)
        : null;
  result.schemaversion = schemaversion;
  const { version, finding } = detectScormVersion(schemaversion);
  result.scormVersion = version;
  if (finding) result.findings.push(finding);

  // Organizations.
  const orgs = (manifest.organizations ?? {}) as Record<string, unknown>;
  result.defaultOrganization =
    typeof orgs["@_default"] === "string"
      ? (orgs["@_default"] as string)
      : null;

  const orgList: unknown[] =
    orgs.organization == null
      ? []
      : Array.isArray(orgs.organization)
        ? orgs.organization
        : [orgs.organization];
  if (orgList.length === 0) {
    result.findings.push({
      category: "manifest",
      severity: "error",
      code: "MANIFEST-NO-ORGANIZATION",
      message:
        "В манифесте нет ни одной организации (organizations/organization)",
    });
  }
  for (const o of orgList) {
    const obj = (o ?? {}) as Record<string, unknown>;
    const org: ManifestOrganization = {
      identifier:
        typeof obj["@_identifier"] === "string"
          ? obj["@_identifier"]
          : undefined,
      title: typeof obj.title === "string" ? obj.title : undefined,
      items: parseItems(obj.item),
    };
    result.organizations.push(org);
    if (!org.items.length) {
      result.findings.push({
        category: "manifest",
        severity: "warning",
        code: "MANIFEST-ORG-EMPTY",
        message: `Организация "${org.identifier ?? "?"}" не содержит ни одного item`,
        details: { organization: org.identifier ?? null },
      });
    }
  }

  // Resources.
  const res = (manifest.resources ?? {}) as Record<string, unknown>;
  result.resources = parseResources(res.resource, result.findings);
  if (result.resources.length === 0) {
    result.findings.push({
      category: "manifest",
      severity: "error",
      code: "MANIFEST-NO-RESOURCES",
      message: "В манифесте нет ни одного ресурса (resources/resource)",
    });
  }

  return result;
}

/**
 * Прочитать и распарсить imsmanifest.xml из корня распакованного пакета.
 * Отсутствие файла — находка, не исключение.
 */
export async function readAndParseManifest(
  packageDir: string,
): Promise<ManifestParseResult> {
  let xml: string;
  try {
    xml = await readFile(join(packageDir, "imsmanifest.xml"), "utf8");
  } catch {
    const result: ManifestParseResult = {
      ok: false,
      scormVersion: null,
      schemaversion: null,
      organizations: [],
      resources: [],
      defaultOrganization: null,
      findings: [
        {
          category: "manifest",
          severity: "error",
          code: "MANIFEST-FILE-MISSING",
          message: "Файл imsmanifest.xml не найден в корне пакета",
        },
      ],
    };
    return result;
  }
  return parseManifestXml(xml);
}
