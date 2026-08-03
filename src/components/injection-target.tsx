import { getInjection, parseInjectionTags } from "@/lib/plugin-injections";

// ---------- 前台注入消费（RSC 读"渲染缓存"，插件代码不在 RSC 执行） ----------

// 把标签属性字符串解析为 React props（支持双引号/单引号/无值布尔属性）
function attrsToProps(attrs: string): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrs)) !== null) {
    const key = m[1].toLowerCase();
    if (m[2] !== undefined) props[key] = m[2];
    else if (m[3] !== undefined) props[key] = m[3];
    else if (m[4] !== undefined) props[key] = m[4];
    else props[key] = true;
  }
  return props;
}

/** head 注入：解析为合法 head 元素（script/meta/link/style），渲染进根布局 <head> */
export async function HeadInjections() {
  const html = await getInjection("head");
  if (!html.trim()) return null;
  const { scripts, metas, links, styles } = parseInjectionTags(html);
  if (!scripts.length && !metas.length && !links.length && !styles.length) return null;
  let key = 0;
  return (
    <>
      {metas.map((t) => {
        const props = attrsToProps(t.attrs);
        if (!Object.keys(props).length) return null;
        return <meta key={`pi-m${key++}`} {...props} />;
      })}
      {links.map((t) => {
        const props = attrsToProps(t.attrs);
        if (!props.href) return null;
        return <link key={`pi-l${key++}`} {...props} />;
      })}
      {styles.map((s) => (
        <style key={`pi-s${key++}`} dangerouslySetInnerHTML={{ __html: s.css }} />
      ))}
      {scripts.map((s) => {
        if (s.inline.trim()) {
          return <script key={`pi-sc${key++}`} dangerouslySetInnerHTML={{ __html: s.inline }} />;
        }
        if (s.src) return <script key={`pi-sc${key++}`} src={s.src} />;
        return null;
      })}
    </>
  );
}

/** 页脚/侧边栏注入：body 内任意 HTML 片段 */
export async function HtmlInjection({ target }: { target: "footer" | "sidebar" }) {
  const html = await getInjection(target);
  if (!html.trim()) return null;
  return (
    <div
      className={`plugin-injection plugin-injection-${target}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
