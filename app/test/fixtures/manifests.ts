/**
 * Синтетические манифесты для тестов парсера (T-011, C-02/C-03 — только синтетика).
 */

export const VALID_2004_3RD = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-1" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Демо-курс</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>Экран 1</title>
      </item>
      <item identifier="ITEM-2">
        <title>Раздел</title>
        <item identifier="ITEM-2-1" identifierref="RES-2">
          <title>Экран 2</title>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="content/page1.html">
      <file href="content/page1.html"/>
      <file href="content/shared.js"/>
    </resource>
    <resource identifier="RES-2" type="webcontent" adlcp:scormType="asset" href="content/page2.html">
      <file href="content/page2.html"/>
    </resource>
  </resources>
</manifest>`;

export const VALID_2004_4TH = VALID_2004_3RD.replace(
  "2004 3rd Edition",
  "_2004_4th Edition",
);

export const MISSING_SCHEMAVERSION = VALID_2004_3RD.replace(
  /\s*<schemaversion>.*<\/schemaversion>/,
  "",
);

export const UNSUPPORTED_VERSION = VALID_2004_3RD.replace(
  "2004 3rd Edition",
  "1.2",
);

export const MALFORMED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="BROKEN">
  <organizations>
    <organization><title>Незакрытый тег`;

export const NO_ORGANIZATIONS = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-2" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-9"/>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="a.html">
      <file href="a.html"/>
    </resource>
  </resources>
</manifest>`;

export const EMPTY_ORG = VALID_2004_3RD.replace(
  /<organization identifier="ORG-1">[\s\S]*?<\/organization>/,
  '<organization identifier="ORG-1"><title>Пусто</title></organization>',
);

export const RESOURCE_NO_SCORMTYPE = VALID_2004_3RD.replace(
  ' adlcp:scormType="sco"',
  "",
);
