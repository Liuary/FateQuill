/** 角色：人物档案 */
export interface Character {
  id: number;
  novelId: number;
  name: string;
  profile: Record<string, unknown>;
}
