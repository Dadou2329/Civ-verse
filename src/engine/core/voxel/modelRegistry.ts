/**
 * Registry of micro-voxel models with lazy, cached builds.
 */
import type { ModelDefinition } from '../packs/definitions';
import { buildModel, type BuiltModel } from './microModel';
import { hashString } from '../util/rng';
import { ASSET_ID_RE } from '../util/ids';

export class ModelRegistry {
  private defs = new Map<string, ModelDefinition>();
  private owners = new Map<string, string>();
  private cache = new Map<string, BuiltModel>();
  private _revision = 0;

  get revision(): number {
    return this._revision;
  }

  register(def: ModelDefinition, owner: string): void {
    if (!ASSET_ID_RE.test(def.id)) throw new Error(`Identifiant de modèle invalide : "${def.id}" (attendu "pack:nom").`);
    const prev = this.owners.get(def.id);
    if (prev && prev !== owner) throw new Error(`Le modèle ${def.id} est déjà défini par "${prev}".`);
    this.defs.set(def.id, def);
    this.owners.set(def.id, owner);
    this.cache.delete(def.id);
    this._revision++;
  }

  unregisterOwner(owner: string): void {
    for (const [id, o] of [...this.owners]) {
      if (o === owner) {
        this.defs.delete(id);
        this.owners.delete(id);
        this.cache.delete(id);
      }
    }
    this._revision++;
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  get(id: string): ModelDefinition | undefined {
    return this.defs.get(id);
  }

  all(): ModelDefinition[] {
    return [...this.defs.values()];
  }

  /** Built geometry (cached). Throws for unknown ids. */
  build(id: string): BuiltModel {
    let b = this.cache.get(id);
    if (!b) {
      const def = this.defs.get(id);
      if (!def) throw new Error(`Modèle inconnu : ${id}`);
      b = buildModel(def.build, def, hashString(id));
      this.cache.set(id, b);
    }
    return b;
  }
}
