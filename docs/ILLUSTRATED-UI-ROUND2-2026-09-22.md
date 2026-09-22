# 第二组原创插画与界面（2026-09-22）

用户要求增加图片，提供 [Metis 紫微](https://metisziwei.com) 作为前端参考。本轮浏览了公开首页与实际画面，采用图片成为功能识别主体、留白和文字层级的思路，保留知时既有纸色、朱红和功能导航。

使用内置 image_gen 工具分别生成六张原创位图，逐张检查主体与构图，仅用 Pillow 等比例缩小并编码 WebP，不修改图像内容。六张均为720×480，总计389,312字节（约380.2 KiB）。原PNG备份位于本任务 outputs/东方插画第二组原图/，以下最终文件均保存在仓库内。

| 页面 | 最终素材 |
| --- | --- |
| bazi | [bazi-v1.webp](../images/studio/bazi-v1.webp) |
| meihua | [meihua-v1.webp](../images/studio/meihua-v1.webp) |
| fengshui | [fengshui-v1.webp](../images/studio/fengshui-v1.webp) |
| face | [face-v1.webp](../images/studio/face-v1.webp) |
| palm | [palm-v1.webp](../images/studio/palm-v1.webp) |
| fortune | [fortune-v1.webp](../images/studio/fortune-v1.webp) |

首页九个功能入口全部采用插画：三张复用上轮合盘、紫微、六爻素材；六张为本轮新增。手机两列、桌面三列；手机最后一张今日运势为横卡。手机首屏缩短，保留今日黄历，用户可以更快看到入口。六张新图同时用于各自工具页标题区；文字、链接与表单保持为原生HTML。图片加载失败时标题和操作仍可用。

图片声明固定尺寸，首页使用lazy+async，工具页只即时加载自身图片；未加入SW预缓存，未引入第三方图片域名。主题原图和旧插画均保留。首页不恢复此前移除的说明、营销或重复按钮；侧栏的服务与免责声明入口保持。

本地浏览器检查首页及六个页面的320/390/1280宽度，21组无横向溢出/损坏图片；独立复核确认原表单控件标签逐项一致、无ID丢失、todayDate和服务说明仍在。综合验证见 [本轮汇总](ALGORITHM-ROUND4-2026-09-22.md)。未推送。

## 最终实际生成提示词

### bazi

```text
Use case: stylized-concept. Asset type: original editorial illustration for a Chinese traditional-culture web app called Zhishi. Create one landscape 3:2 illustration, not a website mockup. Style: refined contemporary Chinese ink painting with mineral pigments, tactile handmade ivory paper, subtle antique brass accents, deep indigo ink and muted cinnabar and moss green. Rich material detail in a compact central scene, generous cream paper breathing room at edges; calm, sophisticated art-book quality with natural soft light, not cute clip art. Composition must remain readable when reduced to a small website card, no text, no numbers, no calligraphy, no logo, no watermark, no interface, no frame. Subject: four slender weathered stone steles standing at different heights on a tiny misty mountainous island, a delicate antique brass arc of sunlight rising behind them, a miniature pine tree and a narrow red sun reflected in water. Symbolic composition about four pillars and passage of time, no engraved characters, no people. Keep all four steles clearly visible and distinct.
```

### meihua

```text
Use case: stylized-concept. Asset type: original editorial illustration for a Chinese traditional-culture web app called Zhishi. Create one landscape 3:2 illustration, not a website mockup. Style: refined contemporary Chinese ink painting with mineral pigments, tactile handmade ivory paper, subtle antique brass accents, deep indigo ink and muted cinnabar and moss green. Rich material detail in a compact central scene, generous cream paper breathing room at edges; calm, sophisticated art-book quality with natural soft light, not cute clip art. Composition must remain readable when reduced to a small website card, no text, no numbers, no calligraphy, no logo, no watermark, no interface, no frame. Subject: an elegant twisting branch of plum blossoms with a few dark red and pale ivory flowers suspended over a small celadon bowl of still water. One fallen red petal creates concentric ripples, behind it a faded ink mountain. Close-up still life, poetic and quiet, a little gold dust in the paper, organic handpainted petal texture.
```

### fengshui

```text
Use case: stylized-concept. Asset type: original editorial illustration for a Chinese traditional-culture web app called Zhishi. Create one landscape 3:2 illustration, not a website mockup. Style: refined contemporary Chinese ink painting with mineral pigments, tactile handmade ivory paper, subtle antique brass accents, deep indigo ink and muted cinnabar and moss green. Rich material detail in a compact central scene, generous cream paper breathing room at edges; calm, sophisticated art-book quality with natural soft light, not cute clip art. Composition must remain readable when reduced to a small website card, no text, no numbers, no calligraphy, no logo, no watermark, no interface, no frame. Subject: a small traditional Chinese courtyard house with dark indigo tiled roof, set between one sheltering pine and a gentle jade-green mountain; a slender river bends softly in the foreground. Miniature landscape seen obliquely from above, spacious and contemplative. Architecture and terrain form one readable compact island composition, no occult symbols.
```

### face

```text
Use case: stylized-concept. Asset type: original editorial illustration for a Chinese traditional-culture web app called Zhishi. Create one landscape 3:2 illustration, not a website mockup. Style: refined contemporary Chinese ink painting with mineral pigments, tactile handmade ivory paper, subtle antique brass accents, deep indigo ink and muted cinnabar and moss green. Rich material detail in a compact central scene, generous cream paper breathing room at edges; calm, sophisticated art-book quality with natural soft light, not cute clip art. Composition must remain readable when reduced to a small website card, no text, no numbers, no calligraphy, no logo, no watermark, no interface, no frame. Subject: a serene unpainted ivory ceramic sculptural head in three-quarter profile, gender-neutral adult with closed eyes, beautiful subtly cracked matte porcelain, beside one thin ink branch. A translucent indigo brush-wash circle behind the head, small muted vermilion accent. An art-museum still life about observing expression, anatomically plausible natural facial proportions, no diagrams or labels.
```

### palm

```text
Use case: stylized-concept. Asset type: original editorial illustration for a Chinese traditional-culture web app called Zhishi. Create one landscape 3:2 illustration, not a website mockup. Style: refined contemporary Chinese ink painting with mineral pigments, tactile handmade ivory paper, subtle antique brass accents, deep indigo ink and muted cinnabar and moss green. Rich material detail in a compact central scene, generous cream paper breathing room at edges; calm, sophisticated art-book quality with natural soft light, not cute clip art. Composition must remain readable when reduced to a small website card, no text, no numbers, no calligraphy, no logo, no watermark, no interface, no frame. Subject: one delicate life-size warm ivory ceramic hand sculpture with exactly five anatomically correct fingers, palm gently open toward the viewer, resting on a small pale stone plinth. Very subtle natural palm creases, a restrained indigo silk ribbon near the base, a quiet thin cinnabar semicircle painted in the distant paper background. Gallery still life about observation, no diagram, no aura, no text.
```

### fortune

```text
Use case: stylized-concept. Asset type: original editorial illustration for a Chinese traditional-culture web app called Zhishi. Create one landscape 3:2 illustration, not a website mockup. Style: refined contemporary Chinese ink painting with mineral pigments, tactile handmade ivory paper, subtle antique brass accents, deep indigo ink and muted cinnabar and moss green. Rich material detail in a compact central scene, generous cream paper breathing room at edges; calm, sophisticated art-book quality with natural soft light, not cute clip art. Composition must remain readable when reduced to a small website card, no text, no numbers, no calligraphy, no logo, no watermark, no interface, no frame. Subject: a small antique brass sundial without numerals on a low weathered stone surface, one young pine branch extending over it and casting a long morning shadow. A vermilion sun rises above a soft distant indigo mountain ridge, wisps of pale cloud. Symbolic quiet scene about a new day and seasons, all contained within a central harmonious composition, no text or markings.
```
