# 藏书阁生成插画（2026-09-24）

使用内置 image_gen 工具生成，非 CLI/API fallback。三张原始图分别为书斋、青绿山水、靛蓝星月；均已查看。使用 bundled sharp 仅缩放和编码为 WebP，未改变画面内容。书名和界面文案由 HTML 渲染，图中不生成书名。

最终站点文件：
- images/library/scholar-room-v1.webp：1440×960，128750 bytes；主视觉。
- images/library/scholar-room-small-v1.webp：720×480，36394 bytes；手机主视觉。
- images/library/mountains-v1.webp：480×720，72864 bytes；青绿书封。
- images/library/stars-v1.webp：480×720，46700 bytes；靛蓝书封。

原图保存在本任务 generated_images 目录；实际页面仅引用仓库内 WebP。主图响应式选取，书封 lazy/async，三种图样复用；书名为 HTML 文字而非图片文字。装饰图 alt 为空。

## 最终提示词

### 1

Generate a finished editorial illustration for a Chinese classical books web library called Zhishi, no text anywhere, no letters, no seals with lettering, no UI. Wide landscape 1536x1024. Refined Song dynasty scholar's library: an old elm desk, two thread-bound cloth books with completely blank covers, a rolled scroll, one small celadon vase and a thin pine branch, distant misty mountains glimpsed through a circular wood lattice window. Composition places all meaningful objects in the right half and generous softly textured warm ivory negative space in the left half for real HTML title overlay. Restrained mineral pigment and delicate ink wash on fine rice paper, tactile handmade paper fibers, soft daylight, muted pine green, antique ochre and fog gray, light warm cream background #f9f5eb. Elegant contemporary museum publication, atmospheric and richly crafted rather than cartoon, no people, no neon, no fantasy symbols, no generic flat vectors. Softly fading edges into ivory. This is a website decorative hero asset, not a screenshot or book mockup.

### 2

Generate a finished portrait illustration, 1024x1536, full bleed art for the cover background of a Chinese classical philosophy book. No book object mockup, no words, no letters, no calligraphy, no border, no seal. Refined dark pine green and muted antique gold mineral pigment painting on visibly fibrous aged paper, mountains rising from a winding river, two graceful ancient pines lower left, fine golden mist contours and very subtle speckles, extensive calm negative space in upper right for a vertical title supplied separately in HTML. Balanced, quiet, luxurious museum publication aesthetic. Rich painterly texture, layered hills, soft engraved details, subdued light. Not a fantasy illustration, not cartoon, not a stock photo or minimal line icon. Cropping-safe central composition.

### 3

Generate a finished portrait illustration, 1024x1536, full bleed art for a scholarly Chinese classical book cover. No book mockup, no text, no numerals, no letters, no watermark, no seals. Deep muted indigo mineral pigment on handmade paper with a luminous small antique gold moon in upper left, wisps of soft cloud, distant mist-covered mountains along bottom, a very subtle arc of celestial stars and fine bronze stipple, calm open upper right for a real HTML vertical title. Beautiful dense pigment and tactile rice paper fibers, restrained elegant Song dynasty inspired ink painting, contemporary museum editorial finish, fine hand-crafted texture. No neon, no obvious zodiac drawings, no fantasy sci-fi, no clip art or generic linear icon.
