const assert = require('node:assert');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('./index.html', 'utf8');

test('filterByColumn functionality', async (t) => {
  await t.test('filters data correctly by given column and value', () => {
    const dom = new JSDOM(html, { url: "http://localhost", runScripts: "dangerously" });
    const window = dom.window;

    // Mock localStorage
    const mockStorage = {
        raidLootData: JSON.stringify([
            { Item: "Sword", Name: "Player1", Class: "Warrior" },
            { Item: "Shield", Name: "Player2", Class: "Warrior" },
            { Item: "Staff", Name: "Player3", Class: "Mage" }
        ])
    };

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key) => mockStorage[key] || null,
        setItem: () => {},
      },
      writable: true
    });

    // Override displayData
    let displayedData = null;
    window.displayData = (data) => {
        displayedData = data;
    };

    window.filterByColumn('Class', 'Warrior');

    assert.strictEqual(displayedData.length, 2);
    assert.strictEqual(displayedData[0].Name, 'Player1');
    assert.strictEqual(displayedData[1].Name, 'Player2');

    window.filterByColumn('Name', 'Player3');
    assert.strictEqual(displayedData.length, 1);
    assert.strictEqual(displayedData[0].Item, 'Staff');
  });

  await t.test('handles empty localStorage', () => {
    const dom = new JSDOM(html, { url: "http://localhost", runScripts: "dangerously" });
    const window = dom.window;

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
      },
      writable: true
    });

    let displayedData = null;
    window.displayData = (data) => {
        displayedData = data;
    };

    window.filterByColumn('Class', 'Warrior');

    assert.strictEqual(displayedData.length, 0);
  });

  await t.test('handles missing column in data', () => {
    const dom = new JSDOM(html, { url: "http://localhost", runScripts: "dangerously" });
    const window = dom.window;

    const mockStorage = {
        raidLootData: JSON.stringify([
            { Item: "Sword", Name: "Player1" },
            { Item: "Shield", Name: "Player2" }
        ])
    };

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key) => mockStorage[key] || null,
      },
      writable: true
    });

    let displayedData = null;
    window.displayData = (data) => {
        displayedData = data;
    };

    window.filterByColumn('MissingColumn', 'Warrior');

    assert.strictEqual(displayedData.length, 0);
  });

  await t.test('handles filtering when values are undefined/null', () => {
     const dom = new JSDOM(html, { url: "http://localhost", runScripts: "dangerously" });
     const window = dom.window;

     const mockStorage = {
         raidLootData: JSON.stringify([
             { Item: "Sword", Name: null },
             { Item: "Shield", Name: undefined },
             { Item: "Staff", Name: "Player3" }
         ])
     };

     Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key) => mockStorage[key] || null,
      },
      writable: true
    });

     let displayedData = null;
     window.displayData = (data) => {
         displayedData = data;
     };

     window.filterByColumn('Name', null);

     assert.strictEqual(displayedData.length, 1);
     assert.strictEqual(displayedData[0].Item, 'Sword');
  });
});
