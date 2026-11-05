import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { ProfileInfo } from '../shared/types';

interface Store { profiles: ProfileInfo[]; active: string }

/** كل Profile ليه فولدر وقاعدة بيانات SQLite خاصة بيه، فاختصاراته وهيستوريه مستقلين. */
export class ProfileStore {
  private file: string;
  private data: Store;

  constructor(private root: string) {
    fs.mkdirSync(root, { recursive: true });
    this.file = path.join(root, 'profiles.json');
    this.data = this.load();
  }

  private load(): Store {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Store;
      if (Array.isArray(d.profiles) && d.profiles.length && d.profiles.some((p) => p.id === d.active)) return d;
    } catch { /* first run or corrupted file */ }
    const fresh: Store = { profiles: [{ id: 'default', name: 'Default' }], active: 'default' };
    fs.writeFileSync(this.file, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  private save() { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); }

  list(): { profiles: ProfileInfo[]; active: string } { return { profiles: this.data.profiles, active: this.data.active }; }
  active(): ProfileInfo { return this.data.profiles.find((p) => p.id === this.data.active)!; }
  dir(id: string): string {
    const d = path.join(this.root, 'profiles', id);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  create(name: string): ProfileInfo {
    name = name.trim().slice(0, 40);
    if (!name) throw new Error('اسم الـ Profile مطلوب');
    const p = { id: 'p' + randomBytes(4).toString('hex'), name };
    this.data.profiles.push(p);
    this.save();
    return p;
  }
  setActive(id: string) {
    if (!this.data.profiles.some((p) => p.id === id)) throw new Error('unknown profile');
    this.data.active = id;
    this.save();
  }
  remove(id: string) {
    if (id === this.data.active) throw new Error('مينفعش تحذف الـ Profile الشغال حاليًا');
    if (this.data.profiles.length <= 1) throw new Error('لازم يفضل Profile واحد');
    this.data.profiles = this.data.profiles.filter((p) => p.id !== id);
    this.save();
    fs.rmSync(path.join(this.root, 'profiles', id), { recursive: true, force: true });
  }
}
