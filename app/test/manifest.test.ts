/**
 * Тесты парсера imsmanifest.xml (T-011).
 * Раннер: node:test (npm test). Фикстуры — синтетические строки, без бинарных пакетов (C-02/C-03).
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  readAndParseManifest,
  parseManifestXml,
  type ManifestParseResult,
} from "../src/lib/manifest.ts";
import {
  EMPTY_ORG,
  MALFORMED_XML,
  MISSING_SCHEMAVERSION,
  NO_ORGANIZATIONS,
  RESOURCE_NO_SCORMTYPE,
  UNSUPPORTED_VERSION,
  VALID_2004_3RD,
  VALID_2004_4TH,
} from "./fixtures/manifests.ts";

function codes(r: ManifestParseResult): string[] {
  return r.findings.map((f) => f.code);
}

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
});

async function pkgWith(xml: string | null): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "t011-"));
  tmpDirs.push(dir);
  if (xml !== null) {
    await writeFile(join(dir, "imsmanifest.xml"), xml, "utf8");
  }
  return dir;
}

describe("parseManifestXml — валидные манифесты", () => {
  it("2004 3rd Edition: версия, организация, ресурсы", () => {
    const r = parseManifestXml(VALID_2004_3RD);
    assert.equal(r.ok, true);
    assert.equal(r.scormVersion, "2004-3rd");
    assert.equal(r.schemaversion, "2004 3rd Edition");
    assert.equal(r.defaultOrganization, "ORG-1");
    assert.equal(r.organizations.length, 1);
    const org = r.organizations[0];
    assert.equal(org.title, "Демо-курс");
    assert.equal(org.items.length, 2);
    assert.equal(org.items[1].children?.[0].identifier, "ITEM-2-1");
    assert.equal(r.resources.length, 2);
    assert.equal(r.resources[0].adlcpScormType, "sco");
    assert.deepEqual(r.resources[0].files, [
      "content/page1.html",
      "content/shared.js",
    ]);
    assert.deepEqual(r.findings, []);
  });

  it("2004 4th Edition распознаётся", () => {
    const r = parseManifestXml(VALID_2004_4TH);
    assert.equal(r.scormVersion, "2004-4th");
    assert.deepEqual(r.findings, []);
  });
});

describe("parseManifestXml — ошибки как находки, не исключения", () => {
  it("битый XML → находка MANIFEST-XML-MALFORMED, ok=false", () => {
    const r = parseManifestXml(MALFORMED_XML);
    assert.equal(r.ok, false);
    assert.ok(codes(r).includes("MANIFEST-XML-MALFORMED"));
    const f = r.findings.find((x) => x.code === "MANIFEST-XML-MALFORMED")!;
    assert.equal(f.severity, "error");
  });

  it("нет schemaversion → ошибка MANIFEST-SCHEMVERSION-MISSING", () => {
    const r = parseManifestXml(MISSING_SCHEMAVERSION);
    assert.ok(codes(r).includes("MANIFEST-SCHEMVERSION-MISSING"));
    assert.equal(r.scormVersion, null);
  });

  it("schemaversion 1.2 → MANIFEST-VERSION-UNSUPPORTED", () => {
    const r = parseManifestXml(UNSUPPORTED_VERSION);
    assert.ok(codes(r).includes("MANIFEST-VERSION-UNSUPPORTED"));
    assert.equal(r.scormVersion, null);
  });

  it("пустая organizations → MANIFEST-NO-ORGANIZATION", () => {
    const r = parseManifestXml(NO_ORGANIZATIONS);
    assert.ok(codes(r).includes("MANIFEST-NO-ORGANIZATION"));
    assert.equal(r.organizations.length, 0);
  });

  it("организация без item → warning MANIFEST-ORG-EMPTY", () => {
    const r = parseManifestXml(EMPTY_ORG);
    const f = r.findings.find((x) => x.code === "MANIFEST-ORG-EMPTY");
    assert.ok(f);
    assert.equal(f.severity, "warning");
  });

  it("ресурс без adlcp:scormType → warning MANIFEST-RESOURCE-NO-SCORMTYPE", () => {
    const r = parseManifestXml(RESOURCE_NO_SCORMTYPE);
    const f = r.findings.find(
      (x) => x.code === "MANIFEST-RESOURCE-NO-SCORMTYPE",
    );
    assert.ok(f);
    assert.equal(f.severity, "warning");
  });
});

describe("readAndParseManifest — файловая обёртка", () => {
  it("imsmanifest.xml отсутствует → находка MANIFEST-FILE-MISSING", async () => {
    const dir = await pkgWith(null);
    const r = await readAndParseManifest(dir);
    assert.equal(r.ok, false);
    assert.ok(codes(r).includes("MANIFEST-FILE-MISSING"));
  });

  it("читает файл из корня пакета", async () => {
    const dir = await pkgWith(VALID_2004_3RD);
    const r = await readAndParseManifest(dir);
    assert.equal(r.scormVersion, "2004-3rd");
  });
});
