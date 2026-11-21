/**
 * KREA ARNÉS — Harness Index
 *
 * Exporta la interfaz del arnés: types, skills, knowledge registry.
 */

export * from "./types";
export { InfoproductosPlugin } from "./infoproductos-plugin";
export {
  KnowledgeRegistry,
  knowledgeRegistry,
  registerBuiltinKnowledge,
  type IKnowledgeModule,
  type KnowledgeCategory,
  type KnowledgeHealth,
} from "./knowledge-registry";
