// adm-zip 最小类型声明（官方无类型包）
declare module "adm-zip" {
  interface ZipEntry {
    entryName: string; // 如 "demo/plugin.json"
    isDirectory: boolean;
  }
  class AdmZip {
    constructor(data?: Buffer | ArrayBuffer);
    getEntries(): ZipEntry[];
    /** 读取条目内容 */
    readFile(entry: ZipEntry | string): Buffer;
    /** 解压单个条目到目标路径 */
    extractEntryTo(entry: ZipEntry, targetPath: string, maintainEntryPath: boolean, overwrite?: boolean): void;
  }
  export default AdmZip;
}
