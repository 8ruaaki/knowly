const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonDB {
  constructor(filename, initialData = []) {
    this.filepath = path.join(DATA_DIR, filename);
    this.initialData = initialData;
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.filepath)) {
      this.save(this.initialData);
    }
  }

  load() {
    try {
      const data = fs.readFileSync(this.filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading ${this.filepath}:`, error);
      return this.initialData;
    }
  }

  save(data) {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error saving ${this.filepath}:`, error);
    }
  }

  // Helper to mimic GAS sheet.appendRow
  append(item) {
    const data = this.load();
    data.push(item);
    this.save(data);
    return data;
  }

  update(predicate, updates) {
    const data = this.load();
    let updated = false;
    const newData = data.map(item => {
      if (predicate(item)) {
        updated = true;
        return { ...item, ...updates };
      }
      return item;
    });
    if (updated) this.save(newData);
    return updated;
  }

  delete(predicate) {
    const data = this.load();
    const newData = data.filter(item => !predicate(item));
    if (newData.length !== data.length) {
      this.save(newData);
      return true;
    }
    return false;
  }

  find(predicate) {
    const data = this.load();
    return data.find(predicate);
  }

  filter(predicate) {
    const data = this.load();
    return data.filter(predicate);
  }
}

module.exports = {
  users: new JsonDB('users.json'),
  progress: new JsonDB('progress.json'),
  badges: new JsonDB('badges.json'),
  history: new JsonDB('history.json'),
  follows: new JsonDB('follows.json'),
};
