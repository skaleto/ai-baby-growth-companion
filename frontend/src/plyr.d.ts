// tsconfig 用的是经典 "Node" moduleResolution,不读 plyr package.json 的 exports.types 条件,
// 导致 `import Plyr from "plyr"` 找不到类型。这里按真实路径把 Plyr 的类型重导出;
// skipLibCheck 为 true,不会连累其内部声明。
declare module "plyr" {
  export { default } from "plyr/src/js/plyr";
}
