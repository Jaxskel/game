import { zipSync, strToU8 } from "fflate";

/** Build a small valid DRM-free EPUB for tests. */
export function makeEpub(): Uint8Array {
  const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
  const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata><dc:title>The Lantern Keeper</dc:title><dc:creator>A. Storyteller</dc:creator></metadata>
  <manifest>
    <item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chap2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`;
  const para =
    "The village of Bellwater sat at the edge of a cold grey sea, and the lantern keeper climbed the spiral stairs. ".repeat(6);
  const chap = (n: number) =>
    `<html><head><title>c${n}</title><style>p{}</style></head><body>
      <h1>CHAPTER ${"I".repeat(n)}</h1>
      ${Array.from({ length: 8 }, () => `<p>${para} It was chapter ${n} &amp; the sea said &ldquo;hello&rdquo;.</p>`).join("\n")}
    </body></html>`;
  return zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(container),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/chap1.xhtml": strToU8(chap(1)),
    "OEBPS/chap2.xhtml": strToU8(chap(2)),
  });
}
